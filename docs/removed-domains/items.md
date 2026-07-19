# Items

Item definitions, initial locations, inventory state, item conditions/effects, item ID mutation, and the `take`, `put`, `give`, `use`, and item-assisted `unlock` runtime behavior were removed.

The item-oriented UI controls and registry slots remain dormant so their visual work is not lost.

## Reintroduction

- Define one authoritative item-location model before restoring item schemas.
- Rebuild inventory and placement runtime state from that model.
- Restore item conditions/effects and player commands only after state transitions have tests.
- Reconnect the existing item pickers and editor controls.

`TODO`: Restore item schemas and engine support as a cohesive vertical slice.
