# Item behaviors and player commands

The item behavior catalog is schema-derived. Every canonical capability tag represents the matching
behavior, and every behavior supplies its editor label, explanation, discovery vocabulary, defaults,
and—where applicable—its standard player actions.

| Behavior         | Standard command families                                                   |
| ---------------- | --------------------------------------------------------------------------- |
| Takeable         | take, get, pick up; drop; place in/on                                       |
| Container        | put or place an item in/inside                                              |
| Surface          | put or place an item on/onto                                                |
| Openable         | open; close or shut                                                         |
| Lockable         | lock; unlock, with automatic or explicit keys                               |
| Door             | normal movement commands, gated by its open and locked state                |
| Usable           | use, operate, activate, or apply alone or with a target                     |
| Equippable       | wear, put on, don, wield, ready; remove, take off, doff, unequip, stow      |
| Readable         | read, peruse, study                                                         |
| Sensory          | smell or sniff; listen or hear; touch or feel; taste or lick                |
| Searchable       | search, rummage, and look in/under/behind                                   |
| Edible           | eat, consume, devour; bite or nibble                                        |
| Drinkable        | drink, gulp, quaff; sip                                                     |
| Switchable       | switch/turn/power on or off; activate/deactivate; start/stop                |
| Lightable        | light, ignite, kindle; extinguish, douse, snuff, or blow out                |
| Sound-making     | play; ring/chime; blow; strike/beat                                         |
| Movable          | push, shove, pull, tug, move, drag, slide, roll, or reposition              |
| Climbable        | climb/ascend/scale; descend/climb down; get down/off                        |
| Resting place    | sit/take a seat; lie/recline; stand/rise/get up                             |
| Enterable        | enter/get in/board; exit/get out/leave/disembark                            |
| Rideable         | mount/get on; ride; dismount/get off                                        |
| Binding          | tie/attach/fasten/bind to a target; untie/detach/unfasten                   |
| Breakable        | break, damage, crack; smash, shatter, wreck                                 |
| Cuttable         | cut, sever, snip; slice/carve; chop/hack, optionally with a tool            |
| Liquid container | fill, optionally from a source; pour, optionally into a target; empty/drain |
| Cleanable        | clean, wash, rinse, scrub, wipe, or polish                                  |
| Repairable       | repair, restore, fix, mend, patch, or sew, optionally with a tool           |
| Writable         | write, inscribe, draw, sketch, mark, or scribble; erase/clear/rub out       |
| Throwable        | throw, toss, hurl, fling, or chuck, optionally at a target                  |
| Give or show     | give, offer, hand, or present; show, display, or reveal to a target         |

Every action can be enabled independently and has an authored success message, blocked message,
optional condition, optional target requirement, and optional after-action effect. Consumable actions
can destroy their item. Stateful behaviors also expose their relevant starting values: equipped, on,
lit, broken, dirty, liquid capacity and amount, or initial writing.

The accepted words live in complete saved command documents under `src/data/commands`. Player-path
tests execute every maintained action phrase and every maintained relation phrase through
`resolveTurn`; lower-level tests cover conditions, targets, disabled actions, state transitions, and
hooks.
