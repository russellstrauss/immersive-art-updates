<template>
	<div id="app">
		<Babylon />
	</div>
</template>

<script>

	import Babylon from './components/Babylon.vue'

	export default {
		
		name: 'App',
		
		components: {
			Babylon
		}
	}
	
</script>

<style>
	body {
		padding: 0;
		margin: 0;
		overflow: hidden;
	}
</style>