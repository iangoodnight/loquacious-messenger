var express = require('express');
var router = express.Router();
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const fetch = require('node-fetch');
const axios = require('axios');

/* GET users listing. */
router.get('/:email', function(req, res, next) {

	console.log("Params: ", req.params);

	let xhr = new XMLHttpRequest();

	function handler() {
		console.log("Response Status: ", this.status);
		console.log("this object: ", this);
		res.json(JSON.parse(this.responseText));

	}

	const email = req.params.email;


	xhr.open("GET", "https://boutsy.com/admin.php?target=RESTAPI&_key=" + process.env.API_KEY + "&_path=profile&_cnd[pattern]=" + email);
	xhr.setRequestHeader("accept", "application/json");
	xhr.setRequestHeader("content-type", "application/json");
	xhr.onload = handler;
	xhr.send();

});

router.post('/data', function(req, res) {
	console.log(req.body);
	let email = req.body.customer.email;

	let profile = axios.get("https://boutsy.com/admin.php?target=RESTAPI&_key=" + process.env.API_KEY + "&_path=profile&_cnd[login]=" + email);
	let orders = axios.get("https://boutsy.com/admin.php?target=RESTAPI&_key=" + process.env.API_KEY + "&_path=order&_cnd[email]=" + email); 

	Promise.allSettled([profile, orders])
		.then((values) => {
			let results = values.map(v => {
				if(v.status === 'fulfilled') {
					return `FULFILLED: ${JSON.stringify(v.value.data[0])} --> ${v.value.data[0].taxId}`;
				}

				return `REJECTED: ${v.reason.message}`;
			});

			console.log(results);
		})
		.catch(reasons => {
			console.log(reasons);
		})

	res.end();
})


module.exports = router;
