const { Client } = require("pg");
const client = new Client({
  host: "127.0.0.1",
  port: 5432,
  user: "aris",
  password: "test123",
  database: "aris"
});
client.connect()
  .then(() => client.query("SELECT 1 as ok"))
  .then(res => { console.log("Connected!", res.rows[0]); client.end(); })
  .catch(err => console.error("Failed:", err.message));
