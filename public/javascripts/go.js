$( document ).ready(function() {

	$("#go").click((e) => {
		e.preventDefault();
		getItGirl();
	});

	function getItGirl() {
		const email = $("#whodat").val().trim();
		let mailbox;
		Number($("#where").val()) === 1 ? mailbox = "sales@boutsy.com"
      : "sales@bulkapothecary.com";
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
			$("#target").html(response.html);
			$("#whodat").val("");
		})
		.fail(() => {
			console.log("lame boy city");
		});
	}
});
