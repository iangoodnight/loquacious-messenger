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
							data.orders = v.value.data;
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

		let date_added = timeConverter(response[0].profile.added);
		let totals = response[1].orders;
		let numberOrders = response[1].orders.length;
		function totalSpent(totals) {
			let total = 0;
			totals.forEach(order => {total += order.subtotal});
			return Math.round(total);
		};
		let grandTotal = totalSpent(totals);

		let html = '<h4><a href="https://boutsy.com/ian-s-hats.html">Boutsy</a></h4>' +
							 '<ul class="c-sb-list c-sb-list--two-line">' +
							   '<li class="c-sb-list-item">' +
							   	 '<span class="c-sb-list-item__label">' +
							   	   'Customer since' +
							   	   '<span class="c-sb-list-item__text">' + date_added + '</span>' +
							   	 '</span>' +
							   '</li>' +
							   '<li class="c-sb-list-item">' +
							   	 '<span class="c-sb-list-item__label">' +
							   	   'Customer profile' +
							   	   '<span class="c-sb-list-item__text"><a href="https://boutsy.com/admin.php?target=profile&profile_id=' + response[0].profile.profile_id + '" target="_blank">' + response[0].profile.login + '</span>' +
							   	 '</span>' +
							   '</li>' +
							   '<li class="c-sb-list-item">' +
							   	 '<span class="c-sb-list-item__label">' +
							   	   'Orders with Boutsy (as customer)' +
							   	   '<span class="c-sb-list-item__text">' + numberOrders + '</span>' +
							   	 '</span>' +
							   '</li>' +
							   '<li class="c-sb-list-item">' +
							   	 '<span class="c-sb-list-item__label">' +
							   	   'Dollars spent (as customer)' +
							   	   '<span class="c-sb-list-item__text">$' + grandTotal + '</span>' +
							   	 '</span>' +
							   '</li>' +
							   '<li class="c-sb-list-item">' +
							   	 '<span class="c-sb-list-item__label">' +
							   	   'Also, here is a drawing of a cloud' +
							   	   '<span class="c-sb-list-item__text"><i class="icon-cloud"></i></span>' +
							   	 '</span>' +
							   '</li>' +
							 '</ul>';

		let helpScoutResponse = { html: ""};

		let escaped = JSON.stringify(html);

		helpScoutResponse.html = html;

	res.send(helpScoutResponse);
	res.end();
})


function timeConverter(UNIX_timestamp){
  let a = new Date(UNIX_timestamp * 1000);
  let months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let year = a.getFullYear();
  let month = months[a.getMonth()];
  let date = a.getDate();
  let hour = a.getHours();
  let min = a.getMinutes();
  let sec = a.getSeconds();
  let time = month + ' ' + date + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
  return time;
}


module.exports = router;
