# snaptest

> **[EN]** Minimal snapshot testing utility — store and compare serialized output across test runs without any test framework dependency.
> **[FR]** Utilitaire de tests de snapshot minimal — stockez et comparez la sortie sérialisée entre les exécutions de tests, sans dépendance à un framework de test.

---

## Features / Fonctionnalités

**[EN]**
- Framework-agnostic: works with any test runner or plain Node.js scripts
- Stores snapshots as JSON in `__snapshots__/` next to the test file
- Auto-creates new snapshots on first run — no manual bootstrapping needed
- Returns structured pass/fail result with expected vs. received diff data
- `update` and `delete` methods for snapshot lifecycle management
- `list` method to inspect all stored snapshot keys for a test file
- `createSnapper` factory for file-scoped snapshot instances
- Serializes objects with pretty-printed JSON; strings stored as-is

**[FR]**
- Agnostique au framework : fonctionne avec tout runner de test ou scripts Node.js simples
- Stocke les snapshots en JSON dans `__snapshots__/` à côté du fichier de test
- Crée automatiquement de nouveaux snapshots à la première exécution — pas de bootstrap manuel
- Retourne un résultat structuré pass/fail avec les données expected vs received
- Méthodes `update` et `delete` pour la gestion du cycle de vie des snapshots
- Méthode `list` pour inspecter toutes les clés de snapshot stockées pour un fichier de test
- Factory `createSnapper` pour des instances de snapshot liées à un fichier
- Sérialise les objets en JSON indenté ; les chaînes sont stockées telles quelles

---

## Installation

```bash
npm install --save-dev @idirdev/snaptest
```

---

## API (Programmatic) / API (Programmation)

```js
const { matchSnapshot, updateSnapshot, deleteSnapshot, listSnapshots, createSnapper, serialize } = require('@idirdev/snaptest');

// ── Using the high-level createSnapper factory ──────────────────────────────
// ── Utiliser la factory createSnapper ──────────────────────────────────────

const snap = createSnapper(__filename);
// Snapshots stored in: __snapshots__/<testfile>.snap

// First run: snapshot created automatically
// Première exécution : snapshot créé automatiquement
const r1 = snap.match('user object', { id: 1, name: 'Alice', active: true });
// => { pass: true, isNew: true }

// Subsequent runs: compared against stored snapshot
// Exécutions suivantes : comparé au snapshot stocké
const r2 = snap.match('user object', { id: 1, name: 'Alice', active: true });
// => { pass: true, isNew: false }

// Mismatch detected
// Différence détectée
const r3 = snap.match('user object', { id: 1, name: 'Bob', active: true });
// => { pass: false, expected: '{"id":1,"name":"Alice"...}', received: '{"id":1,"name":"Bob"...}' }

// Update a snapshot intentionally
// Mettre à jour un snapshot intentionnellement
snap.update('user object', { id: 1, name: 'Bob', active: true });

// List all snapshot keys in this test file
// Lister toutes les clés de snapshot dans ce fichier de test
snap.list(); // => ['user object']

// Delete a snapshot
// Supprimer un snapshot
snap.delete('user object');

// ── Using low-level functions ───────────────────────────────────────────────
// ── Utiliser les fonctions bas niveau ──────────────────────────────────────

matchSnapshot('./tests/api.test.js', 'GET /users response', [{ id: 1 }]);
updateSnapshot('./tests/api.test.js', 'GET /users response', [{ id: 1, name: 'Alice' }]);
listSnapshots('./tests/api.test.js'); // => ['GET /users response']

// Serialize a value manually
// Sérialiser une valeur manuellement
serialize({ key: 'value' }); // => '{
  "key": "value"
}'
serialize('hello');           // => 'hello'
```

---

## License

MIT © idirdev
