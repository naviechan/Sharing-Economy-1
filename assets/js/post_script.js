var slideIndex = 1;
var attractionIndex = 1;
showSlides(slideIndex);
showAttractions(attractionIndex);

function showSlides(n){
	var i;
	var images = document.getElementsByClassName("slide_image");
	if (n > images.length) {
		slideIndex = 1;
	}
	if (n < 1) {
		slideIndex = images.length;
	}
	for (i = 0; i < images.length; i++) {
	   images[i].style.display = "none";
	}
	images[slideIndex-1].style.display = "block";

}

function plusDivs(n) {
  showSlides(slideIndex += n);
}

function showAttractions(n){
	var i;
	var images = document.getElementsByClassName("attraction_image");
	if (n > images.length) {
		attractionIndex = 1;
	}
	if (n < 1) {
		attractionIndex = images.length;
	}
	for (i = 0; i < images.length; i++) {
	   images[i].style.display = "none";
	}
	images[attractionIndex-1].style.display = "block";
}

function plusDivsAttraction(n){
	showAttractions(attractionIndex += n);
}