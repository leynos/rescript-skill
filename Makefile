SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

BUN ?= bun
RESCRIPT = $(BUN) run --bun rescript
RESCRIPT_TOOLS = $(BUN) run --bun rescript-tools
BIOME = $(BUN) run --bun biome
# --dot lints Markdown under dot-directories such as .github. The rule policy
# lives in `.markdownlint.jsonc` and the exclusions in `.markdownlintignore`.
MDLINT = $(BUN) run --bun markdownlint --dot
MDTABLEFIX ?= mdtablefix
MDTABLEFIX_RULES = --git --include-untracked --wrap --renumber --breaks --ellipsis --fences
UV ?= uv
# Defaults, not overrides: a CI provisioner such as astral-sh/setup-uv exports
# UV_CACHE_DIR and fails its post-job cache save when uv wrote somewhere else.
UV_CACHE_DIR ?= .uv-cache
UV_TOOL_DIR ?= .uv-tools
UV_TOOL = UV_CACHE_DIR=$(UV_CACHE_DIR) UV_TOOL_DIR=$(UV_TOOL_DIR) $(UV) tool run --python 3.14.7
# v0.1.3, pinned to the peeled tag commit rather than a mutable ref.
TYPOS_CONFIG_BUILDER = $(UV_TOOL) --from \
	"git+https://github.com/leynos/typos-config-builder.git@c8a4f95d7cf7f6a1b7517f2775d122d47d5721eb" \
	typos-config-builder
# The Agent Skills reference validator, pinned to a commit of the agentskills
# repository rather than to a release, as in python-skill and rust-skill.
SKILLS_REF = $(UV_TOOL) --from \
	"git+https://github.com/agentskills/agentskills.git@69ef37e9424c0a7ea9dd2293b559e43ec8176379\#subdirectory=skills-ref" \
	skills-ref
YAMLLINT = $(UV_TOOL) --from yamllint==1.38.0 yamllint
SKILL_YAMLLINT_CONFIG := {extends: default, rules: {line-length: disable}}

# The skill manifest contract. SKILL_DIRS defaults to every shipped skill and
# can be overridden to check one skill or a test fixture, for example
# `make skill-manifest-check SKILL_DIRS=skills/rescript-router/`.
SKILL_DIRS ?= $(sort $(dir $(wildcard skills/*/SKILL.md)))

# ReScript sources the official formatter owns: skill examples and suites.
RES_SOURCES = $(shell git ls-files --cached --others --exclude-standard -- '*.res' '*.resi')

# Every suite is named explicitly: Bun does not recognize the compiler's
# `.test.res.mjs` suffix, and a glob over build output could silently run
# nothing on a clean checkout. The ReScript list derives from the sources, so a
# suite whose compiled output is missing fails loudly instead of vanishing.
RES_SUITES = $(patsubst %.res,%.res.mjs,$(wildcard tests/*.test.res))

# Where `make install-skills` copies the catalogue.
SKILLS_DEST ?= $(HOME)/.codex/skills
JS_SUITES = $(wildcard tests/*.test.mjs)

.PHONY: help install install-skills build watch clean fmt check-fmt typecheck lint reanalyze \
	test coverage markdownlint docs-check spelling audit all check \
	skill-frontmatter-lint skill-manifest-validate skill-manifest-check

help: ## List contributor entrypoints
	@awk 'BEGIN {FS = ":.*## "} /^[a-z-]+:.*## / {printf "%-24s %s\n", $$1, $$2}' Makefile

install: ## Install exactly the committed dependency graph
	$(BUN) install --frozen-lockfile

# `git archive` copies exactly the committed skills, never the generated
# `.res.mjs` files that in-source compilation leaves beside the examples.
install-skills: ## Copy the committed skills into SKILLS_DEST (default ~/.codex/skills)
	mkdir -p "$(SKILLS_DEST)"
	git archive --format=tar HEAD skills | tar -x -C "$(SKILLS_DEST)" --strip-components=1

build: ## Compile every skill example and ReScript suite
	$(RESCRIPT) build

watch: ## Rebuild ReScript when source changes
	$(RESCRIPT) watch

clean: ## Remove compiler output and coverage artefacts
	$(RESCRIPT) clean
	rm -rf coverage

fmt: ## Apply canonical ReScript, Markdown fence, support-file, and Markdown formatting
	$(RESCRIPT) format $(RES_SOURCES)
	$(BUN) scripts/check-codeblocks.mjs --write
	$(BIOME) format --write .
	$(MDTABLEFIX) --in-place $(MDTABLEFIX_RULES)
	$(MDLINT) --fix "**/*.md"

check-fmt: ## Check formatting without rewriting anything
	$(RESCRIPT) format --check $(RES_SOURCES)
	$(BUN) scripts/check-codeblocks.mjs --check
	$(BIOME) check --linter-enabled=false --assist-enabled=false .
	$(MDTABLEFIX) --check $(MDTABLEFIX_RULES)

typecheck: ## Compile every source with all warnings promoted to errors
	$(RESCRIPT) build

reanalyze: ## Fail on dead code or unhandled exceptions reported by reanalyze
	+$(MAKE) build
	$(BUN) scripts/check-reanalyze.mjs

lint: ## Compiler, reanalyze, Biome, Markdown, and skill manifest checks
	+$(MAKE) typecheck
	+$(MAKE) reanalyze
	$(BIOME) lint .
	+$(MAKE) markdownlint
	+$(MAKE) skill-manifest-check

# `set -e` matters: without it the loop exits with the status of its final
# iteration, so a conformant trailing skill would mask a malformed earlier one.
skill-frontmatter-lint: ## Lint each skill manifest's YAML frontmatter
	@set -euo pipefail; for skill_dir in $(SKILL_DIRS); do \
		skill_file="$${skill_dir%/}/SKILL.md"; \
		echo "yamllint $$skill_file frontmatter"; \
		awk 'NR == 1 { if ($$0 != "---") exit 1; print; next } $$0 == "---" { found = 1; print; exit } { print } END { if (!found) exit 1 }' "$$skill_file" \
		  | $(YAMLLINT) -d '$(SKILL_YAMLLINT_CONFIG)' -; \
	done

skill-manifest-validate: ## Validate each skill against the Agent Skills schema
	@set -eu; for skill_dir in $(SKILL_DIRS); do \
		echo "skills-ref validate $$skill_dir"; \
		$(SKILLS_REF) validate "$$skill_dir"; \
	done

skill-manifest-check: skill-frontmatter-lint skill-manifest-validate ## Verify every skill manifest

test: ## Compile, then run the ReScript example suites and repository contracts
	+$(MAKE) build
	$(BUN) test $(addprefix ./,$(RES_SUITES)) $(addprefix ./,$(JS_SUITES))

coverage: ## Measure compiled skill examples and write text plus LCOV reports
	+$(MAKE) build
	$(BUN) test --coverage --coverage-reporter=text --coverage-reporter=lcov \
		--coverage-dir=coverage $(addprefix ./,$(RES_SUITES))

markdownlint: ## Lint Markdown with the committed policy
	$(MDLINT) "**/*.md"

docs-check: ## Check Markdown table and wrap formatting, then lint
	$(MDTABLEFIX) --check $(MDTABLEFIX_RULES)
	+$(MAKE) markdownlint

spelling: ## Regenerate and enforce the shared en-GB-oxendict spelling policy
	$(TYPOS_CONFIG_BUILDER) gate --repository .

audit: ## Audit the installed lockfile with Bun's advisory client
	$(BUN) audit

all: ## Run every commit gate sequentially, even under make -j
	+$(MAKE) check-fmt
	+$(MAKE) lint
	+$(MAKE) test
	+$(MAKE) spelling

check: all ## Alias for `make all`
