const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();

//accept json data
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//1 API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//middleWareFunction
const middleWareFunction = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//2 API
app.get("/states/", middleWareFunction, async (request, response) => {
  const sqlQuery = `SELECT state_id as stateId,state_name as stateName,population FROM state;`;
  const listData = await db.all(sqlQuery);
  response.send(listData);
});

//3 API

app.get("/states/:stateId/", middleWareFunction, async (request, response) => {
  const { stateId } = request.params;
  const sqlQuery = `SELECT state_id as stateId,state_name as stateName,population FROM state where state_id='${stateId}';`;
  const listData = await db.get(sqlQuery);
  response.send(listData);
});

//4 API
app.post("/districts/", middleWareFunction, async (request, response) => {
  const requestDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = requestDetails;
  const insertQuery = `INSERT into district(district_name,state_id,cases,cured,active,deaths) values
   (
       '${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}'
   );`;
  const dbResponse = await db.run(insertQuery);
  response.send("District Successfully Added");
});

//5 API Get single value
app.get(
  "/districts/:districtId/",
  middleWareFunction,
  async (request, response) => {
    const { districtId } = request.params;
    const sqlQuery = `SELECT district_id as districtId,district_name as districtName,state_id as stateId,cases,cured,active,deaths FROM district where district_id='${districtId}';`;
    const listData = await db.get(sqlQuery);
    response.send(listData);
  }
);

//6 API delete
app.delete(
  "/districts/:districtId/",
  middleWareFunction,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district where district_id='${districtId}';`;
    const teamMates = await db.exec(deleteQuery);
    response.send("District Removed");
  }
);

//7 API update single value
app.put(
  "/districts/:districtId/",
  middleWareFunction,
  async (request, response) => {
    const requestDetails = request.body;
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = requestDetails;
    const updateQuery = `update district set district_name='${districtName}',state_id='${stateId}'
  ,cases='${cases}',cured='${cured}',active='${active}',deaths='${deaths}' where district_id='${districtId}'`;
    const dbResponse = await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//8 get API
app.get(
  "/states/:stateId/stats/",
  middleWareFunction,
  async (request, response) => {
    const { stateId } = request.params;
    const sqlQuery = `SELECT sum(cases) as totalCases,sum(cured) as totalCured,
  sum(active) as totalActive, sum(deaths) as totalDeaths FROM district where state_id='${stateId}';`;
    const listResponse = await db.get(sqlQuery);
    response.send(listResponse);
  }
);

module.exports = app;
