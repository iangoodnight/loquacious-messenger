$( document ).ready(function() {

	console.log("Yowzah!");

	$("#go").click((e) => {
		e.preventDefault();
		getItGirl();
	});

	function getItGirl() {
		let email = $("#whodat").val().trim();
		let mailbox;
		Number($("#where").val()) === 1 ? mailbox = "sales@boutsy.com": "sales@bulkapothecary.com";
		console.log(`Email: ${email}\nMailbox: ${mailbox}`);
		$.ajax({
			type: "POST",
			url: "/users/data",
			data: JSON.stringify({
				customer: {
					email: email,
					fname: "Boutsy",
					lname: "Profile"
				},
				mailbox: {
					email: mailbox
				}				
			}),
			dataType: "json",
			contentType: "application/json"
		})
		.done((response) => {
			console.log("Naaaaailed it");
			console.log(response);
			$("#target").html(response.html);
			$("#whodat").val("");
		})
		.fail(() => {
			console.log("lame boy city");
		});
			
	}


});