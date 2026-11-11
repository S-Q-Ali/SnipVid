## Summary

<!-- Describe what this pull request changes and why. -->

## Related Issues

<!-- Closes #... -->

## Verification Checklist

- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero errors
- [ ] `pnpm test:coverage` passes and meets the >= 80% coverage gate
- [ ] `pnpm test:e2e` passes (`next build` + API E2E suite)
- [ ] No secrets, `.env.local`, or cookie files included in the diff
- [ ] Documentation (`README.md`, `CHANGELOG.md`, `CONSTRAINTS.md`) updated if behavior changed
