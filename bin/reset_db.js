const sync_db = require("../app/models")

sync_db.sequelize.sync({ force: true }).then(() => {
    console.log('Drop and Resync Database with { force: true }')
    initial()
}).catch((err) => {
    console.log(err)
})

function initial() {
    // Empty
}