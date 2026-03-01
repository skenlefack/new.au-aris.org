const { Client } = require("pg");
const client = new Client({
  host: "127.0.0.1",
  port: 5432,
  user: "aris",
  database: "aris"
});
client.connect()
  .then(() => client.query("SELECT current_user, inet_server_addr()"))
  .then(res => { console.log("OK!", res.rows[0]); client.end(); })
  .catch(err => console.error("Failed:", err.message));
