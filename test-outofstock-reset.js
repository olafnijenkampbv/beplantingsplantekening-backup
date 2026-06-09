const db = require('better-sqlite3')('data/plants.db');
db.prepare("UPDATE plants SET in_stock = 1 WHERE id = 'ACGRISEU'").run();
db.prepare("UPDATE plant_variants SET availability = 'in_stock' WHERE plant_id = 'ACGRISEU'").run();
console.log('Acer griseum staat weer op voorraad.');
