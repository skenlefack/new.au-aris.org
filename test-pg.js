const { Client } = require("pg");
const client = new Client({
  host: "localhost",
  port: 5432,
  user: "aris",
  password: "aris_dev_2024",
  database: "aris"
});
client.connect()
  .then(() => client.query("SELECT current_user, version()"))
  .then(res => { console.log("PG connected!", res.rows[0]); client.end(); })
  .catch(err => console.error("PG failed:", err.message));
