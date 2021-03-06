var express = require('express');
var router = express.Router();
const fetch = require('node-fetch');
const axios = require('axios');

router.post('/data', async function(req, res) {
	console.log(req.body);
	const email = req.body.customer.email;
	const mailbox = req.body.mailbox.email;
	const randomResponse = [
    'Probably a ghost.',
    'I don\'t know this one.',
    'Beats me.',
    'Beep-Boop, computer error.',
    'Their face looks familiar, but I\'m not sure we\'ve met.',
    'Computer took a break to grab a byte to eat',
    'New customer, who dis?',
    'ლ(ಠ益ಠლ)',
    'Hey there, stranger.',
    'Too sleepy to go on.'
  ];
	const goofy = randomResponse[Math.floor(Math.random() * 10)];
	if (mailbox === 'support@boutsy.com' ||
      mailbox === 'build@boutsy.com'||
      mailbox === 'sales@boutsy.com') {
	  //  Defining our intial promises.
    //  For customers, this will be all the information we need.
		const profile = axios.get(
      'https://boutsy.com/admin.php?target=RESTAPI&_key=' +
      process.env.API_KEY +
      '&_path=profile&_cnd[login]=' +
      email
    );
		const orders = axios.get(
      'https://boutsy.com/admin.php?target=RESTAPI&_key=' +
      process.env.API_KEY +
      '&_path=order&_cnd[email]=' +
      email
    );
		//  Initial API calls
		const response = await Promise.allSettled([profile, orders])
			.then((values) => {
				const results = values.map(v => {
					const data = {};
					if(v.status === 'fulfilled') {
						const target = v.value.config.url
              .split('&_path=')[1].split('&_cnd')[0];
						switch (target) {
							case 'profile':
								data.profile = v.value.data[0];
								break;
							case 'order':
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
				return results;
			})
			.catch(reasons => {
				console.log(reasons);
			}
		);

		if (response[0].profile !== undefined) {
			if (response[0].profile.access_level !== 100) {
				const date_added = timeConverter(response[0].profile.added);
				const totals = response[1].orders;
				const numberOrders = response[1].orders.length;
				function totalSpent(totals) {
					let total = 0;
					totals.forEach(order => {total += order.subtotal});
					return Math.round(total);
				};
				const grandTotal = totalSpent(totals);
				let subOrders;
				numberOrders > 10 ? subOrders = 10: subOrders = numberOrders;

				const orderList = listOrders(response[1].orders);

				const html =
          '<h4>' +
            '<a href="https://boutsy.com/ian-s-hats.html" target="_blank">' +
              'Boutsy' +
            '</a>'
          '</h4>' +
					'<div class="c-sb-section c-sb-section--toggle">' +
            '<div class="c-sb-section__title js-sb-toggle">' +
              'Profile <i class="caret sb-caret"></i>' +
            '</div>' +
            '<div class="c-sb-section__body">' +
              '<ul class="unstyled">' +
                '<li>' +
                  '<strong>' +
                    '<a' +
                      'href="https://boutsy.com/admin.php' +
                      '?target=profile&profile_id=' +
                      response[0].profile.profile_id +
                      '" target="_blank" ' +
                    '>' +
                      req.body.customer.fname + ' ' +
                      req.body.customer.lname +
                    '</a>' +
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
              '<i class="icon-cart icon-sb"></i> Order History (' +
                subOrders + ')' +
              '<i class="caret sb-caret"></i>' +
            '</div>' +
            '<div class="c-sb-section__body">' +
              '<ul class="unstyled">' +
                orderList +
              '</ul>' +
            '</div>' +
          '</div>';

				const helpScoutResponse = {};

				helpScoutResponse.html = html;

				res.send(helpScoutResponse);

			} else if (response[0].profile.access_level === 100) {
				const date_added = timeConverter(response[0].profile.added);
				const details = axios.get(
          'https://boutsy.com/admin.php?target=RESTAPI&_key=' +
          process.env.API_KEY +
          '&_path=profile/' +
          response[0].profile.profile_id
        );
				const additionalDetails = await details
					.then((data) => {
						return data.data;
					})
					.catch((error) => {
						console.log(error.message);
					}
				);

				const vendorTranslations = axios.get(
          'https://boutsy.com/admin.php?target=RESTAPI&_key=' +
          process.env.API_KEY +
          '&_path=xc-multivendor-vendor/' +
          additionalDetails.vendor.id
        );
				const vendorData = await vendorTranslations
					.then(data => {
						return data.data;
					})
					.catch(error => {
						console.log(error.message);
					});

				const vendorCategories = await getCategories(additionalDetails);
				const numberProducts = additionalDetails.products.length;
				let frontEndCatURL;
				let shippingWarning = '';
				let unTrustedWarning = '';
				if (vendorCategories.cats.length !== 0) {
					frontEndCatURL =
            '<a href="https://boutsy.com/cart.php' +
            '?target=category&category_id=' +
            vendorCategories.cats[0].category_id +'" ' +
            'target="_blank">' +
            numberProducts +
            '</a>'
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
					shippingWarning =
            '<li class="red">This vendor has no shipping methods</li>';
				};

				if (additionalDetails.vendor.isTrustedVendor === false) {
					unTrustedWarning =
            '<li class="red">This vendor is untrusted.</li>';
				}
			  let targetUrl = '';
			  if (additionalDetails.cleanURLs.length > 0) {
			  	targetUrl = additionalDetails.cleanURLs[0].cleanURL;
			  }
			  let cleanCompanyName = 'Boutsy Profile';
			  if (vendorData.translations.length > 0) {
			  	cleanCompanyName = vendorData.translations[0].companyName;
			  }
				const html =
          '<h4>' +
            '<a href="https://boutsy.com/' + targetUrl + '" target="_blank">' +
              'Boutsy' +
            '</a>' +
          '</h4>' +
            '<div class="c-sb-section c-sb-section--toggle">' +
              '<div class="c-sb-section__title js-sb-toggle">' +
                'Profile <i class="caret sb-caret"></i>' +
              '</div>' +
              '<div class="c-sb-section__body">' +
                '<ul class="unstyled">' +
                  '<li>' +
                    '<strong>' +
                      '<a ' +
                        'href="https://boutsy.com/admin.php' +
                        '?target=profile&profile_id=' +
                        response[0].profile.profile_id.toString() + '" ' +
                        'target="_blank">' +
                        cleanCompanyName +
                      '</a>' +
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

				const helpScoutResponse = {};

				helpScoutResponse.html = html;

				res.send(helpScoutResponse);

			};
		} else {
			const notFound = '<h4>' + goofy + '</h4>';
    	res.send({html: notFound});
		};

		res.end();

	// BEGIN BULK APOTHECARY HANDLING
	} else if (mailbox === 'sales@bulkapothecary.com') {
		const targetUrlBulk = encodeURI(
      'https://api.bigcommerce.com/stores/' +
      process.env.BULK_STORE_HASH +
      '/v3/customers?email:in=' +
      email
    );
		const targetUrlNato = encodeURI(
      'https://api.bigcommerce.com/stores/' +
      process.env.NATOIL_STORE_HASH +
      '/v3/customers?email:in=' +
      email
    );
		const targetUrlF220 = encodeURI(
      'https://api.bigcommerce.com/stores/' +
      process.env.F220_STORE_HASH +
      '/v3/customers?email:in=' +
      email
    );
		let targets = 0;
		let profile;
		const profileBulk = await axios.get(targetUrlBulk,
			{
			headers: {
				'accept': 'application/json',
				'content-type': 'application/json',
				'x-auth-client': process.env.BULK_X_CLIENT,
				'x-auth-token': process.env.BULK_X_TOKEN
			}
		});
		const profileNato = await axios.get(targetUrlNato,
			{
			headers: {
				'accept': 'application/json',
				'content-type': 'application/json',
				'x-auth-client': process.env.NATOIL_X_CLIENT,
				'x-auth-token': process.env.NATOIL_X_TOKEN
			}
		});
		const profileF22 = await axios.get(targetUrlF220,
			{
			headers: {
				'accept': 'application/json',
				'content-type': 'application/json',
				'x-auth-client': process.env.F220_X_CLIENT,
				'x-auth-token': process.env.F220_X_TOKEN
			}
		});

		const responseCollection = await Promise.allSettled(
      [profileBulk, profileNato, profileF22]
    )
      .then((values) => {
				const results = values.map(v => {
					let data = {};
					if(v.status === 'fulfilled') {
						data = v.value;
						return data;
					}
					return `REJECTED: ${v.reason.message}`;
				});
				return results;
			})
			.then(results => {
				return results;
			})
			.catch(reasons => {
				console.log(reasons);
			}
		);
		let pointer;
		let hash;
		let client;
		let token;
		let orderPointer;

		if (responseCollection[0].data.data.length !== 0) {
			profile = responseCollection[0];
			pointer =
        '<h4>' +
          '<a ' +
            'href="https://bulkapothecary.com/manage" ' +
            'target="_blank"' +
          '>' +
            'Bulk Apothecary' +
          '</a>' +
        '</h4>';
			hash = process.env.BULK_STORE_HASH;
			client = process.env.BULK_X_CLIENT;
			token = process.env.BULK_X_TOKEN;
			orderPointer = 'B';
		} else if (responseCollection[1].data.data.length !== 0) {
			profile = responseCollection[1];
			pointer =
        '<h4>' +
          '<a ' +
            'href="https://naturesoil.com/manage" ' +
            'target="_blank"' +
          '>' +
            'Nature\'s Oil' +
          '</a>' +
        '</h4>';
			hash = process.env.NATOIL_STORE_HASH;
			client = process.env.NATOIL_X_CLIENT;
			token = process.env.NATOIL_X_TOKEN;
			orderPointer = 'N';
		} else if (responseCollection[2].data.data.length !== 0) {
			profile = responseCollection[2];
			pointer =
        '<h4>' +
          '<a ' +
            'href="https://fashion220.net/manage"' +
            'target="_blank"' +
          '>' +
            'Fashion 220' +
          '</a>' +
        '</h4>';
			hash = process.env.F220_STORE_HASH;
			client = process.env.F220_X_CLIENT;
			token = process.env.F220_X_TOKEN;
			orderPointer = 'F';
		} else {
			profile = {
				data: {
					data: []
				}
			};
		};

		let profileId = '';

		profile.data.data.length !== 0 ? profileId = profile.data.data[0].id
      : profileId = '';
		const ordersUrl = encodeURI(
      'https://api.bigcommerce.com/stores/' +
      hash +
      '/v2/orders?customer_id=' +
      profileId
    );
		let orders;
		if (profileId !== '') {
			orders = await axios.get(ordersUrl,
				{
				headers: {
					'accept': 'application/json',
					'content-type': 'application/json',
					'x-auth-client': client,
					'x-auth-token': token
				}
			});
		} else {
			orders = { data: [] };
		};
		let dateCreated = '';

		if (profile.data.data.length !== 0) {
			const rawDate = profile.data.data[0].date_created
        .split('T')[0].split('-');
			dateCreated = rawDate[1] + '/' + rawDate[2] + '/' + rawDate[0];
		} else {
			dateCreated = 'Not registered';
		};

		let ordersTotal = BCOrderAggregator(orders.data);
		let profileLink = '';
		let profileHref = '';

		if (orders.data.length !== 0) {
			switch (orderPointer) {
				case 'B':
					profileLink =
            '<a ' +
              'href="https://www.bulkapothecary.com/manage/orders?customerId=' +
              profileId + '" ' +
              'target="_blank"' +
            '>' +
              profile.data.data[0].first_name + ' ' +
              profile.data.data[0].last_name +
            '</a>'
					profileHref =
            'https://www.bulkapothecary.com/manage/orders?customerId=' +
            profileId;
					break;
				case 'N':
					profileLink =
            '<a ' +
              'href="https://www.naturesoil.com/manage/orders?customerId=' +
              profileId + '" ' +
              'target="_blank"' +
            '>' +
              profile.data.data[0].first_name + ' ' +
              profile.data.data[0].last_name +
            '</a>'
					profileHref =
            'https://www.naturesoil.com/manage/orders?customerId=' + profileId;
					break;
				case 'F':
					profileLink =
            'a ' +
              'href="https://www.fashion220.net/manage/orders?customerId=' +
              profileId + '" ' +
              'target="_blank"' +
            '>' +
              profile.data.data[0].first_name + ' ' +
              profile.data.data[0].last_name +
            '</a>'
					profileHref =
            'https://www.fashion220.net/manage/orders?customerId=' + profileId;
					break;
				default:
					break;
			}
		} else {
			profileLink = req.body.customer.fname + ' ' + req.body.customer.lname;
			profileHref = '#';
		}

		const orderList = listBCOrders(ordersTotal.orderSummary);

		const html = pointer +
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
				  		'<i class="icon-cart icon-sb"></i> Order History (' +
              '<a href="' + profileHref + '" target="_blank">' +
                ordersTotal.number +
              '</a>)' +
				  		'<i class="caret sb-caret"></i>' +
				  	'</div>' +
				  	'<div class="c-sb-section__body">' +
				  		'<ul class="unstyled">' +
				  			orderList +
				  		'</ul>' +
				  	'</div>' +
				  '</div>';
		if (profile.data.data.length !== 0) {
    	res.send({html: html});
		} else {
			const notFound = '<h4>' + goofy + '</h4>';
    	res.send({html: notFound});
		}
		res.end();
	} // End Mailbox "IF"
});

function listOrders(orders) {
	let counter = 0;
	let list = '';
	for (var i = orders.length - 1; i >= 0; i--) {
		const purchaseDate = timeConverter(orders[i].date);
		const purchaseTotal = Math.round(orders[i].total)*(-1);
		const orderURL = 'https://boutsy.com/admin.php?target=order&order_number=' +
      orders[i].orderNumber;
		list +=
      '<li>' +
        '<span class="muted">' + purchaseDate + '</span> - $' +
        purchaseTotal +
        ' (<a href="' + orderURL + '" target="_blank">#' +
        orders[i].orderNumber + '</a>)' +
      '</li>';
		counter++;
		if (counter === 10) {
			break;
		}
	}
	return list;
}

function listBCOrders(orders) {
	let list = '';
	for (var i = 0; i < orders.length; i++) {
		let shipped = '';
		let notes = '';
		orders[i].shipped !== 'N/A' ?
      shipped = ' on ' + orders[i].shipped: shipped = '';
		orders[i].notes !== '' ?
      notes = '<li>Notes: ' + orders[i].notes + '</li>' : notes = '';

		const el = '<li>Order <strong>#' + orders[i].id + '</strong></li>' +
      '<li>Date: ' + orders[i].created + '</li>' +
      '<li>Total: $' + orders[i].total + '</li>' +
        notes +
      '<li class="divider">Status: ' + '<span class="green">' +
        orders[i].status + '</span>' + shipped +
      '</li>';
		list += el;
	};
	return list;
};

function timeConverter(UNIX_timestamp){
  const a = new Date(UNIX_timestamp * 1000);
  const months =
    ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const year = a.getFullYear();
  const month = months[a.getMonth()];
  const date = a.getDate();
  const time = month + ' ' + date + ', ' + year;
  return time;
};

async function getCategories(details) {
	const categoryArr = details.categories;
	const primaryLevelCats = [];
	const formattedResponse = [];
	const catTranslations = {
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
    45: "Misc",
		276: "Gift",
		1845: "Coming Soon"
	};
	if (categoryArr.length !== 0) {
		for(let i = 0; i < categoryArr.length; i++) {
			const cat = categoryArr[i];
			if (cat.depth === 1) {
				let li = '';
				primaryLevelCats.push(cat);
				primaryLevelCats.length > 1 ? li += ', ': li+='';
				const catID = cat['category_id'];
				const parentCall = axios.get(
          'https://boutsy.com/admin.php?target=RESTAPI&_key='
          + process.env.API_KEY +
          '&_path=category/' +
          catID
        );
				const parentCategory = await parentCall
					.then(data => {
						return data.data;
					})
					.catch(error => {
						console.log(error.message);
					});

				const newLi =
          '<a href="https://boutsy.com/admin.php?target=category&id=' +
          catID +
          '" target="_blank">' +
            catTranslations[parentCategory.parent.category_id] +
          '</a>';
				li += newLi;
				formattedResponse.push(li);
			};
		};
		const html = formattedResponse.join('');
		return {
			html: html,
			cats: primaryLevelCats
		};
	} else {
		formattedResponse.push('<span class="red">Uncategorized</span>');
		return {
			html: formattedResponse[0],
			cats: [[]]
		}
	}

}

function BCOrderAggregator (orderData) {

	let orderTotal = 0;
	let refundedTotal = 0;
	let numberOrders = 0;
	const recentOrders = [];

	if (orderData.length !== 0) {
		const reversed = orderData.reverse();
		reversed.forEach(order => {
			const recent = {};

			if (recentOrders.length <= 10) {
				recent.id = order.id;
				recent.total = Number(order.total_inc_tax);
				recent.status = order.status;
				order.staff_notes === '' ? recent.notes = ''
          : recent.notes = order.staff_notes;
				recent.created = order.date_created.split(' ').slice(0, 4).join(' ');
				order.date_shipped === ''? recent.shipped = 'N/A'
          : recent.shipped = order.date_shipped.split(' ')
            .slice(0, 4).join(' ');
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
