const express = require("express");
const mongoose = require("mongoose");
const app = require("./app");
const config = require("./config/config");
const userRouter = require("./routes/v1/user.route");
const authRouter = require("./routes/v1/auth.route")
const PORT = process.env.PORT;
const DB_URI = process.env.MONGODB_URL;
// TODO: CRIO_TASK_MODULE_UNDERSTANDING_BASICS - Create Mongo connection and get the express app to listen on config.port

mongoose.connect(DB_URI).then(()=> {
    console.log("Connect at", DB_URI)
}).catch((error) => {
    console.log(error);
})

app.listen(PORT,()=> {
    console.log("Connect at", PORT)
})
app.use(express.json())
