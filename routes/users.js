var express = require('express');
var router = express.Router();
const fetch = require('node-fetch');
const axios = require('axios');

router.post('/data', async function(req, res) {
	// Debugging helpscout request
	// console.log(req.body);
	// console.log(req);
	let email = req.body.customer.email;
	let mailbox = req.body.mailbox.email;

	if (mailbox === 'support@boutsy.com' || mailbox === 'build@boutsy.com'|| mailbox === 'sales@boutsy.com') {
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
	
	
		console.log(response[0].profile);
	
		if (response[0].profile !== undefined) {
			if (response[0].profile.access_level !== 100) {
				let date_added = timeConverter(response[0].profile.added);
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
				let shippingWarning = '';
				let unTrustedWarning = '';
				// console.log("vendorCategories: ", vendorCategories.cats);
				// console.log("Vendor Translations: ", vendorData);
				if (vendorCategories.cats.length !== 0) {
					frontEndCatURL = '<a href="https://boutsy.com/cart.php?target=category&category_id=' + vendorCategories.cats[0].category_id + '" target="_blank">' + numberProducts + '</a>'		
				} else {
					frontEndCatURL = "0";
				};
	
				let vendorBalance = 0;
				if (additionalDetails.profileTransactions.length > 0) {
					additionalDetails.profileTransactions.forEach(transaction => {
						vendorBalance += transaction.value;
					})
				};
	
				if (additionalDetails.shippingMethods.length === 0) {
					shippingWarning = '<li class="red">This vendor has no shipping methods</li>';
				};
	
				if (additionalDetails.vendor.isTrustedVendor === false) {
					unTrustedWarning = '<li class="red">This vendor is untrusted.</li>';				
				}
		
				// console.log("Debug: ", additionalDetails.cleanURLs);
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
							  			'Vendor Balance: $' + Math.round(vendorBalance)*(-1) +
							  		'</li>' +
							  		shippingWarning +
							  		unTrustedWarning +
					  			'</ul>' +
					  		'</div>' +
				  		'</div>';
		
				let helpScoutResponse = {};
		
				helpScoutResponse.html = html;
		
				res.send(helpScoutResponse);
		
    		// res.send({html: "<h4>Beep-Boop under construction</h4>"})
			}; 
		} else {
    	res.send({html: "<h4>Probably a ghost.</h4>"})
		};
		// test
	
		res.end();

	// BEGIN BULK APOTHECARY HANDLING
	} else if (mailbox === 'sales@bulkapothecary.com') {

		console.log("Aiming for the BigCommerce API...");
		let targetUrl = encodeURI('https://api.bigcommerce.com/stores/' + process.env.FF220_STORE_HASH + '/v3/customers?email:in=' + email);
		console.log("targetURL: ", targetUrl);
		let profile = await axios.get(targetUrl, 
			{
			headers: {
				'accept': 'application/json',
				'content-type': 'application/json',
				'x-auth-client': process.env.F220_X_CLIENT,
				'x-auth-token': process.env.F220_X_TOKEN
			}
		});
		let profileId;
		console.log("Debug: ", profile.data);
		profile.data.data.length !== 0 ? profileId = profile.data.data[0].id: profileId = '';
		let ordersUrl = encodeURI('https://api.bigcommerce.com/stores/' + process.env.FF220_STORE_HASH + '/v2/orders?customer_id=' + profileId);
		let orders;
		if (profileId !== '') {
			orders = await axios.get(ordersUrl, 
				{
				headers: {
					'accept': 'application/json',
					'content-type': 'application/json',
					'x-auth-client': process.env.F220_X_CLIENT,
					'x-auth-token': process.env.F220_X_TOKEN
				}
			});
		} else {
			orders = { data: [] };
		};
		let dateCreated = '';

		if (profile.data.data.length !== 0) {
			let rawDate = profile.data.data[0].date_created.split('T')[0].split('-');
			dateCreated = rawDate[1] + '/' + rawDate[2] + '/' + rawDate[0];
		} else {
			dateCreated = 'Not registered';
		};

		let ordersTotal = BCOrderAggregator(orders.data);
		let profileLink = '';
		let profileHref = '';

		if (orders.data.length !== 0) {
			profileLink = '<a href="https://www.fashion220.net/manage/orders?customerId=' + profileId + '" target="_blank">' + profile.data.data[0].first_name + ' ' + profile.data.data[0].last_name + '</a>'
			profileHref = 'https://www.fashion220.net/manage/orders?customerId=' + profileId;
		} else {
			profileLink = req.body.customer.fname + ' ' + req.body.customer.lname;
			profileHref = '#';
		}

		let orderList = listBCOrders(ordersTotal.orderSummary);

		console.log('Profile: ', profile.data);
		// console.log('Orders: ', orders.data);
		console.log('Date created: ', dateCreated);
		console.log('Orders Total: ', ordersTotal);

		let html = '<h4><a href="https://fashion220.net/manage">Fashion 220</a></h4>' +
					'<div class="c-sb-section c-sb-section--toggle">' +
						'<div class="c-sb-section__title js-sb-toggle">' +
							'Profile <i class="caret sb-caret"></i>' +
						'</div>' +
						'<div class="c-sb-section__body">' +
							'<ul class="unstyled">' +
						  	'<li>' +
						  		'<strong>' +
							   		profileLink +
							 		'</strong>' +
						  	'</li>' +
							  '<li>' +
							  	'Customer since: ' + dateCreated +
							  '</li>' +
							  '<li>' +
							  	'$' + ordersTotal.total + ' lifetime spending' +
							  '</li>' +
							  '<li>' +
							  	'$'  + ordersTotal.refunded + ' lifetime refunds' +
							  '</li>' +
					  	'</ul>' +
					  '</div>' +
				  '</div>' +
				  '<div class="c-sb-section c-sb-section--toggle">' +
				  	'<div class="c-sb-section__title js-sb-toggle">' +
				  		'<i class="icon-cart icon-sb"></i> Order History (' + '<a href="' + profileHref + '" target="_blank">' + ordersTotal.number + '</a>)' +
				  		'<i class="caret sb-caret"></i>' +
				  	'</div>' +
				  	'<div class="c-sb-section__body">' +
				  		'<ul class="unstyled">' +
				  			orderList +
				  		'</ul>' +
				  	'</div>' +
				  '</div>';
		console.log("HTML: ", html);
		if (profile.data.data.length !== 0) {
    	res.send({html: html});			
		} else {
			res.send({html: "<h4>Probably a ghost.</h4>"})
		}
		res.end();
	} // End Mailbox "IF"
});

function listOrders(orders) {
	let counter = 0;
	let list = '';
	for (var i = orders.length - 1; i >= 0; i--) {
		let purchaseDate = timeConverter(orders[i].date);
		let purchaseTotal = Math.round(orders[i].total)*(-1);
		let orderURL = 'https://boutsy.com/admin.php?target=order&order_number=' + orders[i].orderNumber;
		list += '<li><span class="muted">' + purchaseDate + '</span> - $' + purchaseTotal + ' (<a href="' + orderURL + '" target="_blank">#' + orders[i].orderNumber + '</a>)</li>';
		counter++;
		if (counter === 10) { 
			break; 
		}
	}
	return list;
};

function listBCOrders(orders) {
	let list = '';
	for (var i = 0; i < orders.length; i++) {
		let shipped = '';
		let notes = '';
		orders[i].shipped !== 'N/A' ? shipped = ' on ' + orders[i].shipped: shipped = '';
		orders[i].notes !== '' ? notes = '<li>Order notes: ' + orders[i].notes + '</li>' : notes = '';

		let el = '<li>Order #' + orders[i].id + '</li>' +
		'<li>Order date: ' + orders[i].created + '</li>' +
		'<li>Order total: $' + orders[i].total + '</li>' +
		notes +
		'<li class="divider">Order status ' + orders[i].status + shipped + '</li>';
		list += el;
	};
	console.log('List: ', list);
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
	// console.log("Let's see the details: ", details);
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
		for(let i = 0; i < categoryArr.length; i++) {
			let cat = categoryArr[i];
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
				let newLi = '<a href="https://boutsy.com/admin.php?target=category&id=' + catID + '" target="_blank">' + catTranslations[parentCategory.parent.category_id] + '</a>';
				li += newLi;
				console.log("LI: ", li);
				formattedResponse.push(li);
			};
		};
		console.log("FORMATTEDRESPONSE: ", formattedResponse);
		let html = formattedResponse.join('');
		return {
			html: html,
			cats: primaryLevelCats
		};
	} else {
		formattedResponse.push('<span class="red">Uncategorized</span>');
		console.log("FORMATTEDRESPONSE: ", formattedResponse[0]);
		return {
			html: formattedResponse[0],
			cats: [[]]
		}
	}

};

function BCOrderAggregator (orderData) {

	let orderTotal = 0;
	let refundedTotal = 0;
	let numberOrders = 0;
	let recentOrders = [];

	if (orderData.length !== 0) {
		let reversed = orderData.reverse();
		reversed.forEach(order => {
			let recent = {};

			if (recentOrders.length <= 10) {
				recent.id = order.id;
				recent.total = Number(order.total_inc_tax);
				recent.status = order.status;
				order.staff_notes === '' ? recent.notes = '': recent.notes = order.staff_notes;
				recent.created = order.date_created.split(' ').slice(0, 4).join(' ');
				order.date_shipped === '' ? recent.shipped = 'N/A': recent.shipped = order.date_shipped.split(' ').slice(0, 4).join(' ');
				recentOrders.push(recent);
			}
			orderTotal += Number(order.total_inc_tax);
			refundedTotal += Number(order.refunded_amount);
		});
		numberOrders = orderData.length;
	}

	orderTotal = Math.round(orderTotal);
	refundedTotal = Math.round(refundedTotal);

	return { 
		total: orderTotal,
		number: numberOrders,
		refunded: refundedTotal,
		orderSummary: recentOrders
	};

}

module.exports = router;
