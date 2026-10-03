# Progressive disclosure audit checklist

Use this checklist when reviewing an existing repository or validating a substantial instruction reorganization.

## Entry points

- [ ] Every directory likely to be used as the starting working directory was considered.
- [ ] Each independent application, package, service, or operations area has enough local guidance.
- [ ] No boundary depends on an instruction file that a session starting there cannot discover.
- [ ] Nested repositories remain usable when cloned without the surrounding shell repository, or the missing optional context is stated clearly.

## Classification

- [ ] Every proposed `AGENTS.md` represents a plausible independent working boundary.
- [ ] Single scripts and focused documents remain leaves unless they have an independent workflow.
- [ ] Generated, vendored, cached, archived, and temporary paths are excluded from normal routing.
- [ ] A leaf can be promoted later without redesigning the whole hierarchy.

## Routing

- [ ] Routes are expressed in terms of user or agent intent.
- [ ] Each important but non-obvious tool is reachable from an applicable entry point.
- [ ] Each route points to the most specific stable source.
- [ ] Overlapping tools explain their different evidence or responsibility boundaries.
- [ ] Cross-platform and cross-repository tasks route to shared context rather than assuming one implementation is canonical.

## Guide contents

- [ ] Scope and exclusions are clear.
- [ ] Mandatory reading is distinguished from conditional reading.
- [ ] Build, test, run, and validation commands are accurate.
- [ ] Critical safety, privacy, architecture, and workflow invariants are present.
- [ ] Current status is linked rather than copied.
- [ ] Detailed procedures and architecture remain in their canonical documents.
- [ ] A child boundary is safe to enter without assuming its parent guide was loaded.

## Durability

- [ ] No guide contains stale branch tips, dirty-file inventories, or current test counts unless the repository explicitly requires them there.
- [ ] File catalogs are limited to stable, decision-relevant paths.
- [ ] Facts are not duplicated across several guides without a clear reason.
- [ ] Compatibility pointer files follow local conventions and contain no duplicated instructions.
- [ ] No guide contains credentials, secrets, personal data, or unsafe local paths.

## Validation

- [ ] Every referenced path exists, or an optional/external path is labeled as such.
- [ ] Relative links resolve from the file containing them.
- [ ] Advertised `AGENTS.md` files actually exist.
- [ ] Formatting and repository-specific documentation checks pass.
- [ ] Representative tasks were traced from each likely entry point to an authoritative leaf.
- [ ] The final diff contains no unrelated changes.

## Audit report

Report findings by impact:

- **Blocking:** a likely session cannot discover mandatory instructions, or a route creates a safety or correctness risk.
- **Important:** a major tool, subsystem, or authority boundary is hard to discover or misleadingly described.
- **Optional:** the path works but can be shorter, clearer, or less repetitive.

For each finding, name the entry point, the task being attempted, where discovery fails, and the smallest durable correction.
