let utils = (function() {
	
	var appSettings;
	
	return {
		appSettings: {
			breakpoints: {
				mobileMax: 767,
				tabletMin: 768,
				tabletMax: 991,
				desktopMin: 992,
				desktopLargeMin: 1200
			}
		},
		
		mobile: function() {
			return window.innerWidth < this.appSettings.breakpoints.tabletMin;
		},
		
		tablet: function() {
			return (window.innerWidth > this.appSettings.breakpoints.mobileMax && window.innerWidth < this.appSettings.breakpoints.desktopMin);
		},
		
		desktop: function() {
			return window.innerWidth > this.appSettings.breakpoints.desktopMin;
		},
		
		getBreakpoint: function() {
			if (window.innerWidth < this.appSettings.breakpoints.tabletMin) return 'mobile';
			else if (window.innerWidth < this.appSettings.breakpoints.desktopMin) return 'tablet';
			else return 'desktop';
		},
		
		debounce: function(func, wait, immediate) {
			var timeout;
			return function () {
				var context = this, args = arguments;
				var later = function () {
					timeout = null;
					if (!immediate) func.apply(context, args);
				};
				var callNow = immediate && !timeout;
				clearTimeout(timeout);
				timeout = setTimeout(later, wait);
				if (callNow) func.apply(context, args);
			};
		},
		
		secondsToMilliseconds: function(seconds) {
			return seconds * 1000;
		},
		
		isInteger: function(number) {
			return number % 1 === 0;
		},
		
		rotate: function(array) {
			array.push(array.shift());
			return array;
		},
		
		randomInt: function(min, max) {
			min = Math.ceil(min);
			max = Math.floor(max);
			return Math.floor(Math.random() * (max - min + 1)) + min;
		},

		roundHundreths: function(num) {
			return Math.round(num * 100) / 100;
		},
		
		next: function(array, currentItem) { // function tp prevent index out of bounds. If next is called on last item, the first will be returned
		
			let itemIndex = array.findIndex(function(element) {
				return element === currentItem;
			});
			return array[(itemIndex + 1) % array.length];
		},
		
		iOS: function() {
			return [
				'iPad Simulator',
				'iPhone Simulator',
				'iPod Simulator',
				'iPad',
				'iPhone',
				'iPod'
			].includes(navigator.platform)
			// iPad on iOS 13 detection
			|| (navigator.userAgent.includes("Mac") && "ontouchend" in document)
		}
	}
})();

export default utils;