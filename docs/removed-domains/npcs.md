# NPCs

NPC definitions, schedules, inventories, topics, disposition, NPC conditions/effects, runtime references, and NPC-directed commands were removed.

NPC-oriented UI controls and registry slots remain dormant.

## Reintroduction

- Establish NPC identity, location, and lifecycle state first.
- Add schedules and dialogue only after basic placement is stable.
- Restore NPC conditions/effects together with their runtime resolver tests.
- Reconnect existing NPC picker UI after the schema exists again.

The complete reintroduction is specified as horizontal capability slices in
`docs/npc-system-plan.md`. Do not restore the removed schema wholesale; it hard-coded several
genre-specific assumptions and did not provide a complete runtime-backed player path.
