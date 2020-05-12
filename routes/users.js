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

router.post('/data', async function(req, res) {
	// console.log(req.body);
	console.log(req);
	let email = req.body.customer.email;

	let profile = axios.get("https://boutsy.com/admin.php?target=RESTAPI&_key=" + process.env.API_KEY + "&_path=profile&_cnd[login]=" + email);
	let orders = axios.get("https://boutsy.com/admin.php?target=RESTAPI&_key=" + process.env.API_KEY + "&_path=order&_cnd[email]=" + email); 
	
	let response = await Promise.allSettled([profile, orders])
		.then((values) => {

			let results = values.map(v => {
				let data = {};
				if(v.status === 'fulfilled') {

					let target = v.value.config.url.split('&_path=')[1].split('&_cnd')[0];
					console.log(v.value.data[0]);
					console.log('target: ', target);
					switch (target) {
						case 'profile':
							console.log('case: profile');
							data.profile = v.value.data[0];
							break;
						case 'order':
							console.log('case: order');
							data.orders = v.value.data[0];
							break;
						default:
							break;
					};
					return data;	
				}

				return `REJECTED: ${v.reason.message}`;
			});
			return results;
		})
		.then(results => {
			console.log("Results: ", results);
			// res.send(results);
			return results;
		})
		.catch(reasons => {
			console.log(reasons);
		});

		let html = '<h4><a href="https://boutsy.com/ian-s-hats.html">Boutsy</a></h4>' +
							 '<ul class="c-sb-list c-sb-list--two-line">' +
							   '<li class="c-sb-list-item">' +
							   	 '<span class="c-sb-list-item__label">' +
							   	   'Customer since' +
							   	   '<span class="c-sb-list-item__text">' + response[0].profile.added + '</span>' +
							   	 '</span>' +
							   '</li>' +
							 '</ul>';

		let helpScoutResponse = { html: ""};

		let escaped = JSON.stringify(html);

		helpScoutResponse.html = html;

	res.send(helpScoutResponse);
	res.end();
})


module.exports = router;
