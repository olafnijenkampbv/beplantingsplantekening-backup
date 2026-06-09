const db = require('better-sqlite3')('data/plants.db');
db.prepare("UPDATE plants SET in_stock = 0 WHERE id = 'ACGRISEU'").run();
db.prepare("UPDATE plant_variants SET availability = 'out_of_stock' WHERE plant_id = 'ACGRISEU'").run();
console.log('Acer griseum staat nu op uitverkocht.');
