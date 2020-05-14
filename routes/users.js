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
	// Debugging helpscout request
	// console.log(req.body);
	// console.log(req);
	let email = req.body.customer.email;
	//  Defining our intial promises.  For customers, this will be all the information we need.
	let profile = axios.get("https://boutsy.com/admin.php?target=RESTAPI&_key=" + process.env.API_KEY + "&_path=profile&_cnd[login]=" + email);
	let orders = axios.get("https://boutsy.com/admin.php?target=RESTAPI&_key=" + process.env.API_KEY + "&_path=order&_cnd[email]=" + email); 
	//  Initial API calls
	let response = await Promise.allSettled([profile, orders])
		.then((values) => {

			let results = values.map(v => {
				let data = {};
				if(v.status === 'fulfilled') {

					let target = v.value.config.url.split('&_path=')[1].split('&_cnd')[0];
					// console.log(v.value.data[0]);
					console.log('target: ', target);
					switch (target) {
						case 'profile':
							// console.log('case: profile');
							data.profile = v.value.data[0];
							break;
						case 'order':
							// console.log('case: order');
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
			// console.log("Results: ", results);
			return results;
		})
		.catch(reasons => {
			console.log(reasons);
		}
	);



	if (response[0].profile !== undefined) {
		if (response[0].profile.access_level !== 100) {
			let date_added = timeConverter(response[0].profile.added);
			console.log(response[1].orders[0]);
			console.log(response[1].orders[6]);
			let totals = response[1].orders;
			let numberOrders = response[1].orders.length;
			function totalSpent(totals) {
				let total = 0;
				totals.forEach(order => {total += order.subtotal});
				return Math.round(total);
			};
			let grandTotal = totalSpent(totals);
			let subOrders;
			numberOrders > 10 ? subOrders = 10: subOrders = numberOrders;
	
			let orderList = listOrders(response[1].orders);
	
			let html = '<h4><a href="https://boutsy.com/ian-s-hats.html">Boutsy</a></h4>' +
						'<div class="c-sb-section c-sb-section--toggle">' +
							'<div class="c-sb-section__title js-sb-toggle">' +
								'Profile <i class="caret sb-caret"></i>' +
							'</div>' +
							'<div class="c-sb-section__body">' +
								'<ul class="unstyled">' +
						  		'<li>' +
						  			'<strong>' +
							   			'<a href="https://boutsy.com/admin.php?target=profile&profile_id=' + response[0].profile.profile_id + '" target="_blank">' + req.body.customer.fname + ' ' + req.body.customer.lname + '</a>' +
							 			'</strong>' +
						  		'</li>' +
							  	'<li>' +
							  		'$' + grandTotal + ' lifetime spending' +
							  	'</li>' +
							  	'<li>' +
							  		'Customer since: ' + date_added +
							  	'</li>' +
							  	'<li>' +
							  		numberOrders + ' orders' +
							  	'</li>' +
					  		'</ul>' +
					  	'</div>' +
				  	'</div>' +
				  	'<div class="c-sb-section c-sb-section--toggle">' +
				  		'<div class="c-sb-section__title js-sb-toggle">' +
				  			'<i class="icon-cart icon-sb"></i> Order History (' + subOrders + ')' +
				  			'<i class="caret sb-caret"></i>' +
				  		'</div>' +
				  		'<div class="c-sb-section__body">' +
				  			'<ul class="unstyled">' +
				  				orderList +
				  			'</ul>' +
				  		'</div>' +
				  	'</div>';
	
			let helpScoutResponse = {};
	
			helpScoutResponse.html = html;
	
			res.send(helpScoutResponse);
	
		} else if (response[0].profile.access_level === 100) {
			let date_added = timeConverter(response[0].profile.added);
			let details = axios.get("https://boutsy.com/admin.php?target=RESTAPI&_key=" + process.env.API_KEY + "&_path=profile/" + response[0].profile.profile_id);
			let additionalDetails = await details
				.then((data) => {
					// console.log("additionalDetails: ", data);
					console.log("conversations: ", data.data.conversations);
					// console.log("products: ", data.data.products);
					console.log("companyFieldValues: ", data.data.companyFieldValues);
					console.log("cleanUrls: ", data.data.cleanURLs);
					console.log("vendorPartners: ", data.data.vendorPartners);
					console.log("categories: ", data.data.categories);
					return data.data;
				})
				.catch((error) => {
					console.log(error.message);
				}
			);
			// console.log('Returned Data: ', additionalDetails);
			let vendorTranslations = axios.get("https://boutsy.com/admin.php?target=RESTAPI&_key=" + process.env.API_KEY + "&_path=xc-multivendor-vendor/" + additionalDetails.vendor.id);
			let vendorData = await vendorTranslations
				.then(data => {
					return data.data;
				})
				.catch(error => {
					console.log(error.message);
				});
	
			// console.log("VendorData: ", vendorData);
			let vendorCategories = await getCategories(additionalDetails);
			let numberProducts = additionalDetails.products.length;
			let frontEndCatURL;
			console.log("vendorCategories: ", vendorCategories.cats);
			console.log("Vendor Translations: ", vendorData);
			vendorCategories.cats[0].category_id ? frontEndCatURL = '<a href="https://dev.boutsy.com/cart.php?target=category&category_id=' + vendorCategories.cats[0].category_id + '" target="_blank">' + numberProducts + '</a>'
			: numberProducts;
			let vendorBalance = 0;
			if (additionalDetails.profileTransactions.length > 0) {
				additionalDetails.profileTransactions.forEach(transaction => {
					vendorBalance += transaction.value;
				})
			};
	
			console.log("Debug: ", additionalDetails.cleanURLs);
			let html = '<h4><a href="https://boutsy.com/' + additionalDetails.cleanURLs[0].cleanURL + '">Boutsy</a></h4>' +
						'<div class="c-sb-section c-sb-section--toggle">' +
							'<div class="c-sb-section__title js-sb-toggle">' +
								'Profile <i class="caret sb-caret"></i>' +
							'</div>' +
							'<div class="c-sb-section__body">' +
								'<ul class="unstyled">' +
						  		'<li>' +
						  			'<strong>' +
							   			'<a href="https://boutsy.com/admin.php?target=profile&profile_id=' + response[0].profile.profile_id.toString() + '" target="_blank">' + vendorData.translations[0].companyName + '</a>' +
							 			'</strong>' +
						  		'</li>' +
							  	'<li>' +
							  		'Categorized as ' + vendorCategories.html +
							  	'</li>' +
							  	'<li>' +
							  		'Vendor since: ' + date_added +
							  	'</li>' +
							  	'<li>' +
							  		frontEndCatURL  + ' products' +
							  	'</li>' +
							  	'<li>' +
							  		'Vendor Balance: $' + Math.round(vendorBalance) +
							  	'</li>' +
					  		'</ul>' +
					  	'</div>' +
				  	'</div>';
	
			let helpScoutResponse = {};
	
			helpScoutResponse.html = html;
	
			res.send(helpScoutResponse);
	
    	// res.send({html: "<h4>Beep-Boop under construction</h4>"})
		} else {
    	res.send({html: "<h4>Probably a ghost.</h4>"})
		};
	};
	// test

	res.end();
});

function listOrders(orders) {
	let counter = 0;
	let list = '';
	for (var i = orders.length - 1; i >= 0; i--) {
		let purchaseDate = timeConverter(orders[i].date);
		let purchaseTotal = Math.round(orders[i].total);
		let orderURL = 'https://boutsy.com/admin.php?target=order&order_number=' + orders[i].orderNumber;
		list += '<li><span class="muted">' + purchaseDate + '</span> - $' + purchaseTotal + ' (<a href="' + orderURL + '" target="_blank">#' + orders[i].orderNumber + '</a>)</li>';
		counter++;
		if (counter === 10) { 
			break; 
		}
	}
	return list;
};

function timeConverter(UNIX_timestamp){
  let a = new Date(UNIX_timestamp * 1000);
  let months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let year = a.getFullYear();
  let month = months[a.getMonth()];
  let date = a.getDate();
  let time = month + ' ' + date + ', ' + year;
  return time;
};

async function getCategories(details) {
	console.log("Let's see the details: ", details);
	let categoryArr = details.categories;
	let primaryLevelCats = [];
	let formattedResponse = [];
	let catTranslations = {
		13: "Women",
		31: "Men",
		32: "Beauty",
		33: "Craft",
		34: "Home",
		35: "Kid",
		36: "Kitchen",
		37: "Pet",
		38: "Stationery",
		39: "Wellness",
		42: "Jewelry",
		1845: "Coming Soon"
	};
	if (categoryArr.length !== 0) {
		categoryArr.forEach(async cat => {
			console.log("Meow, I'm a cat: ", cat);
			if (cat.depth === 1) {
				let li = '';
				primaryLevelCats.push(cat);
				primaryLevelCats.length > 1 ? li += ', ': li+='';
				var catID = cat['category_id'];
				console.log('catID: ', catID)
				let parentCall = axios.get("https://boutsy.com/admin.php?target=RESTAPI&_key=" + process.env.API_KEY + "&_path=category/" + catID);
				let parentCategory = await parentCall
					.then(data => {
						return data.data;
					})
					.catch(error => {
						console.log(error.message);
					});

				console.log("Kill the parents: ", parentCategory);
				let newLi = '<a href="https://boutsy.com/admin.php?target=category&id=' + catID + '" target="_blank>' + catTranslations[parentCategory.parent.category_id] + '</a>';
				li += newLi;
				formattedResponse.push(li);
			};
		});
		let html = formattedResponse.join('');
		return {
			html: html,
			cats: primaryLevelCats
		};
	} else {
		formattedResponse.push('Uncategorized');
		return {
			html: formattedResponse[0],
			cats: []
		}
	}
};

module.exports = router;
