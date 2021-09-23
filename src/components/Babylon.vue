<template>
	<div>
		<canvas id='renderCanvas'></canvas>
	</div>
</template>

<script>
	import * as BABYLON from 'babylonjs';
	import * as BABYLONGUI from 'babylonjs-gui'; BABYLON.GUI = BABYLONGUI;
	import 'babylonjs-loaders';
	import 'babylonjs-serializers';
	import 'babylonjs-inspector';
	import * as graphics from '@/assets/js/graphics.js'; const gfx = graphics.default;
	
	let canvas, engine, scene, camera, ground, xrHelper;
	let menuItems = [], activeTool, laserTool, lineTool, strokeTool, blockTool, dragTool, bubbleTool, eraseTool, saveTool, resetTool;
	let frameCount = 0;
	let userAddedObjects = [], cursor, cursorMaterial, defaultCursorAlpha = .75, laserCursor, laserCursorMaterial, leftController, rightController, floorUI, selectionMode = false, lineAddingGhost = {}, scalingRod = {}, picked, dragging = false, adjust, rightJoystick = { value: { x: 0, y: 0 } }, joystickActive, draggedObjects = [], colorpickers = [], pickers = [];
	let activeColor = new BABYLON.Color3(1, 1, 1), selectedMesh, line = { addingState: false }, stroke = { addingState: false, path: [], colors: [] }, rightBActive = false;
	let red = new BABYLON.Color3(1, 0, 0), green = new BABYLON.Color3(0, 1, 0), white = new BABYLON.Color3(1, 1, 1), black = new BABYLON.Color3(0, 0, 0), selectedColor = new BABYLON.Color3(0, 1, 0);
	let ribbonPerpen;
	
	class MenuItemBlock {

		constructor(pt, title) {
			
			let self = this;
			this.position = pt;
			this.active = false;
			this.title = title;
			this.boxSize = .5;
			this.selecting = false;
			this.box = BABYLON.MeshBuilder.CreateBox('MenuItemBlock', {size: this.boxSize}, scene);
			this.box.position = new BABYLON.Vector3(pt.x, pt.y + this.boxSize/2, pt.z);
			this.box.material = new BABYLON.StandardMaterial('menuItemMaterial', scene);
			this.enableWireframe(this.box, new BABYLON.Color3.White);
			this.box.edgesColor.a = .5;
			this.box.isMenu = true;
			this.submenuItems = [];
			this.submenuOptions = ['line', 'ribbon'];
			menuItems.push(this);
			
			this.plane = BABYLON.MeshBuilder.CreatePlane('plane', {height: 1, width: 1}, scene);
			this.plane.isPickable = false;
			this.plane.position = gfx.movePoint(pt, new BABYLON.Vector3(0, this.boxSize + .4, 0));
			this.line = gfx.createLine(gfx.movePoint(pt, new BABYLON.Vector3(0, this.boxSize + .1, 0)), new BABYLON.Vector3(0, .15, 0), white);
			this.line.isPickable = false;
			let advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(this.plane);
			let label = new BABYLON.GUI.TextBlock();
			label.text = title;
			label.color = 'white';
			label.fontSize = 300;
			advancedTexture.addControl(label);
			
			this.plane.lookAt(new BABYLON.Vector3(0, 0, 0));
			this.plane.addRotation(0, Math.PI, 0);
			
			this.calculateSubMenuPositions(new BABYLON.Vector3(0, 0, 0));
			
			this.box.getParent = function() {
				return self;
			}
		}
		
		setActive() {
			
			this.setSubMenuInactive();
			this.showSubmenu();
			menuItems.forEach(function(menuItem) {
				menuItem.setInactive();
			});
			
			this.mode = this.submenuOptions[0];
			this.box.edgesColor = BABYLON.Color4.FromColor3(selectedColor);
			this.box.edgesColor.a = .5;
			this.selecting = true;
			this.active = true;
			activeTool = this;
		}
		
		setInactive() {
			this.box.edgesColor = BABYLON.Color4.FromColor3(new BABYLON.Color3.White);
			this.box.edgesColor.a = 1;
			this.active = false;
		}
		
		enableWireframe(mesh, color) {
			if (mesh.material) mesh.material.alpha = 0;
			mesh.enableEdgesRendering();	
			mesh.edgesWidth = .5;
			mesh.edgesColor = BABYLON.Color4.FromColor3(color);
		}
		
		showSubmenu() {
			this.submenuItems.forEach(function(submenuItem) {
				submenuItem.show();
			});
		}
		
		setSubMenuActive(picked) {
			
			let self = this;
			self.setSubMenuInactive();
			self.showSubmenu();
			picked.edgesColor = BABYLON.Color4.FromColor3(selectedColor);
			picked.edgesColor.a = .5;
			picked.scaling = new BABYLON.Vector3(1.5, 1.5, 1.5);
			
			self.submenuItems.forEach(function(submenuItem) {
				if (picked === submenuItem.mesh) self.mode = submenuItem.title;
			});
		}
		
		setSubMenuInactive() {
			let self = this;
			self.submenuItems.forEach(function(submenuItem) {
				submenuItem.mesh.edgesColor = BABYLON.Color4.FromColor3(new BABYLON.Color3.White);
				submenuItem.mesh.edgesColor.a = 1;
				self.enableWireframe(submenuItem.mesh, new BABYLON.Color3.White);
				submenuItem.mesh.scaling = new BABYLON.Vector3(1, 1, 1);
				submenuItem.hide();
			});
		}
		
		calculateSubMenuPositions(position) {
			
			let self = this;
			if (this.title === 'Stroke' || this.title === 'Line') {
				
				self.submenuItems.forEach(function(submenuItem) {
					submenuItem.objects.forEach(function(object) {
						object.dispose();
					});
				});
				self.subMenuItems = [];
				
				this.submenuOptions.forEach(function(title, i) {
					
					let toUser = gfx.createVector(self.position, position);
					let perpen = toUser.cross(new BABYLON.Vector3(0, 1, 0)).normalize().scale(-1); // used to make words face the user correctly
					if (i === 1) perpen = perpen.scale(-1);
					
					let lineStart = gfx.movePoint(self.position, new BABYLON.Vector3(perpen.scale(.5).x, self.boxSize * 2.5, perpen.scale(.5).z));
					let subMenuLine = gfx.createVector(self.position, lineStart).normalize().scale(.5);
					let submenuItem = { mesh: BABYLON.MeshBuilder.CreateBox('SubMenuItemBlock', { size: self.boxSize }, scene), objects: [] };
					submenuItem.objects.push(submenuItem.mesh);
					submenuItem.mesh.material = new BABYLON.StandardMaterial('menuItemMaterial', scene);
					submenuItem.mesh.position = gfx.movePoint(lineStart, subMenuLine.scale(2));
					let line = gfx.createLine(lineStart, subMenuLine, white);
					line.isPickable = false;
					
					submenuItem.objects.push(line);
					line = gfx.createLine(gfx.movePoint(submenuItem.mesh.position, new BABYLON.Vector3(0, self.boxSize, 0)), new BABYLON.Vector3(0, .2, 0), white);
					submenuItem.objects.push(line);
					line.isPickable = false;
					submenuItem.objects.push(line);
					let subItemPlane = BABYLON.MeshBuilder.CreatePlane('subitemplane', {height: 1, width: 1}, scene);
					submenuItem.objects.push(subItemPlane);
					subItemPlane.isPickable = false;
					subItemPlane.position = gfx.movePoint(submenuItem.mesh.position, new BABYLON.Vector3(0, self.boxSize + .4, 0));
					subItemPlane.lookAt(position);
					subItemPlane.addRotation(0, Math.PI, 0);
					let subItemAdvancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(subItemPlane);
					let subItemLabel = new BABYLON.GUI.TextBlock();
					submenuItem.title = title;
					subItemLabel.text = submenuItem.title;
					subItemLabel.color = 'white';
					subItemLabel.fontSize = 300;
					subItemAdvancedTexture.addControl(subItemLabel);
					self.submenuItems.push(submenuItem);
				});
				
				this.submenuItems.forEach(function(submenuItem) {
				
					submenuItem.mesh.getParent = function() {
						return self;
					}
					submenuItem.hide = function() {
						submenuItem.objects.forEach(function(object) {
							object.visibility = 0;
						});
					}
					submenuItem.show = function() {
						submenuItem.objects.forEach(function(object) {
							object.visibility = 1;
						});
					}
				});
				self.setSubMenuInactive();
			}
		}
	}

	export default {
		name: 'Babylon',

		mounted: function () {
			
			canvas = document.getElementById('renderCanvas');

			var createDefaultEngine = function () {
				return new BABYLON.Engine(canvas, true, {
					preserveDrawingBuffer: true,
					stencil: true
				});
			};
			
			engine = createDefaultEngine();
			if (!engine) throw 'engine should not be null.';
			scene = this.createScene();
			gfx.setScene(scene);
			engine.runRenderLoop(() => {
				if (scene) {
					scene.render();
					this.everyFrame();
				}
			});

			window.addEventListener('resize', function () {
				engine.resize();
			});
			
			this.initXR();
		},

		methods: {
			
			initXR: async function() {
				xrHelper = await scene.createDefaultXRExperienceAsync( /* optional configuration options */ );
				this.addButtonEvents();
				console.log(xrHelper);
			},
			
			createScene: function() {
			
				let self = this;
				
				scene = new BABYLON.Scene(engine);
				
				camera = new BABYLON.ArcRotateCamera('Camera', -Math.PI / 2, Math.PI / 2, 12, BABYLON.Vector3.Zero(), scene);
				camera.position = new BABYLON.Vector3(0, 1.2, -1.1);
				camera.attachControl(canvas, true);
				
				
				
				// vrHelper = scene.createDefaultVRExperience({ laserToggle: false });
				
				// vrHelper.enableInteractions();
				// vrHelper._teleportationFillColor = '#FF0000';
				// vrHelper._teleportationBorderColor = '#00FF00';
				// vrHelper.enableTeleportation({
				// 	floorMeshName: 'ground'
				// });
				// self.disableTeleportation();
				
				// vrHelper.onEnteringVRObservable.add(function() {
				// 	self.addButtonEvents();
				// });
				// vrHelper.onAfterCameraTeleport.add(function(teleportLocation) {
					
				// 	menuItems.forEach(function(menuItem) {
				// 		menuItem.plane.lookAt(teleportLocation);
				// 		menuItem.plane.addRotation(0, Math.PI, 0);
				// 		menuItem.calculateSubMenuPositions(teleportLocation);
				// 	});
				// });
				
				// vrHelper.onNewMeshPicked.add(pickingInfo => {
				// 	if (pickingInfo.pickedMesh) {
				// 		picked = pickingInfo.pickedMesh;
				// 		//console.log(pickingInfo);
						
				// 		if (activeTool) activeTool.submenuItems.forEach(function(submenuItem) { // set submenu items active
				// 			if (picked === submenuItem.mesh && picked.getParent().selecting) {
				// 				picked.getParent().setSubMenuActive(picked);
				// 			}
				// 		});
				// 	}
				// 	else {
				// 		picked = null;
				// 	}
				// });
				
				self.setLighting();
				self.addMenu();
				self.addColorpicker();
				
				return scene;
			},
			
			everyFrame: function() { 
				
				
				if (rightController) {
					cursor.direction = rightController.getForwardRay(1).direction;
					cursor.position = rightController.devicePosition.add(rightController.getForwardRay(1).direction.scale(cursor.length));
					
					if ((activeTool === blockTool || activeTool === bubbleTool || activeTool === eraseTool || activeTool === dragTool) && scalingRod.scalingState) {
						
						scalingRod.currentLength = gfx.createVector(leftController.devicePosition, rightController.devicePosition).length();
						scalingRod.scaleFactor = ((scalingRod.currentLength / 2) / (scalingRod.initialLength / 2));
						cursor.size = cursor.scalingStartSize * scalingRod.scaleFactor;
						let totalScale = cursor.size / cursor.defaultSize;
						cursor.scaling = new BABYLON.Vector3(totalScale, totalScale, totalScale);
						
						userAddedObjects.forEach(function(object) {
							if (object.dragging) {
								cursor.addChild(object);
							}
							else {
								cursor.removeChild(object);
							}
						});
					}
					
					if (laserCursor) laserCursor.dispose();
					if (activeTool === laserTool) {
						let handLocation = gfx.movePoint(rightController.devicePosition, new BABYLON.Vector3(.01, 0, .01));
						laserCursor = gfx.createLineFromPoints(handLocation, cursor.position, activeColor);
						laserCursor.isPickable = false;
					}
					if (activeTool === lineTool && line.addingState) {
						if (lineAddingGhost.mesh) lineAddingGhost.mesh.dispose();
						lineAddingGhost.start = line.start;
						lineAddingGhost = gfx.createLineGhost(lineAddingGhost, cursor, activeColor);
						
						if (cursor.position) {
							// let ribbonPerpenDirection = gfx.createVector(lineAddingGhost.start, cursor.position).cross(cursor.direction).normalize().scale(.05);
							// if (ribbonPerpen) ribbonPerpen.dispose();
							// ribbonPerpen = gfx.createLine(line.start, ribbonPerpenDirection);
						}
					}
					else {
						if (lineAddingGhost.mesh) lineAddingGhost.mesh.dispose();
					}
					if (activeTool === strokeTool && stroke.addingState) {
						stroke = gfx.createUserStroke(rightController, activeTool, stroke, cursor, activeColor);
						userAddedObjects.push(stroke.mesh);
					}
				}
				frameCount++;
			},
			
			resetStroke: function() {
				stroke.path = [];
				stroke.colors = [];
				stroke.mesh = null;
				stroke.addingState = false;
				stroke.path1 = [];
				stroke.path2 = [];
			},
			
			addCursor: function() {
				
				let self = this;
				cursorMaterial = new BABYLON.StandardMaterial('cursorMaterial', scene);
				cursorMaterial.alpha = 0;
				cursorMaterial.emissiveColor = activeColor;
				cursor = BABYLON.MeshBuilder.CreateBox('cursor', { size: .05}, scene);
				cursor.size = .05;
				cursor.length = 1;
				cursor.isPickable = false;
				cursor.position = new BABYLON.Vector3(0, .75, .75);
				cursor.material = cursorMaterial;
				
				self.updateCursor(activeTool);
			},
			
			updateCursor: function(tool) {
				
				let self = this;
				let length = cursor.length;
				let prevSize = cursor.size;
				cursor.dispose();
				
				let toolCursorDefaultSize = .05;
				if (tool === blockTool) {
					cursor = BABYLON.MeshBuilder.CreateBox('blockCursor', { size: toolCursorDefaultSize}, scene);
				}
				else if (tool == bubbleTool) {
					cursor = BABYLON.MeshBuilder.CreateSphere('bubbleCursor', {diameter: toolCursorDefaultSize}, scene);
				}
				else if (tool == eraseTool) {
					toolCursorDefaultSize = 1;
					cursor = BABYLON.MeshBuilder.CreateIcoSphere('ico', { diameter: toolCursorDefaultSize, subdivisions: 2 }, scene);
				}
				else if (tool == lineTool) {
					toolCursorDefaultSize = .02;
					cursor = BABYLON.MeshBuilder.CreateSphere('lineCursor', {diameter: toolCursorDefaultSize}, scene);
				}
				else if (tool == strokeTool) {
					toolCursorDefaultSize = .025;
					cursor = BABYLON.MeshBuilder.CreateSphere('strokeCursor', {diameter: toolCursorDefaultSize}, scene);
				}
				else if (tool == dragTool) {
					toolCursorDefaultSize = 1;
					cursor = BABYLON.MeshBuilder.CreateBox('dragCursor', {diameter: toolCursorDefaultSize}, scene);
					
					console.log(new BABYLON.Color3.White);
					//if (cursor.material) mesh.material.alpha = 0; // why throwing error? commented but not fixed
					cursor.enableEdgesRendering();	
					cursor.edgesWidth = .5;
					cursor.edgesColor = BABYLON.Color4.FromColor3(new BABYLON.Color3.White);
					
				}
				if (laserCursor) laserCursor.material.alpha = 0;
				cursor.size = toolCursorDefaultSize;
				cursor.defaultSize = toolCursorDefaultSize;
				cursor.material = cursorMaterial;
				cursorMaterial.alpha = defaultCursorAlpha;
				cursor.length = length;
				cursor.isPickable = false;
				
				if (tool === laserTool) {
					
					laserCursorMaterial = new BABYLON.StandardMaterial('laserCursorMaterial', scene);
					if (laserCursor) laserCursor.dispose();
					laserCursor = gfx.createLine(rightController.devicePosition, new BABYLON.Vector3(0, 1, 0), activeColor);
					laserCursor.size = .05;
					laserCursor.length = 1;
					laserCursor.isPickable = false;
					laserCursor.position = new BABYLON.Vector3(0, .75, .75);
					laserCursor.material = laserCursorMaterial;
					cursorMaterial.alpha = 0;
					laserCursor.material.alpha = 1;
				}
				else if (tool === eraseTool) {
					cursor.material.emissiveColor = new BABYLON.Color3(1, 0, 0);
					cursor.material.wireframe = true;
				}
				else if (tool === dragTool) {
					cursor.material.alpha = 0;
				}
				else {
					cursor.material.wireframe = false;
					cursor.material.emissiveColor = activeColor;
				}
			},
			
			enableWireframe: function(mesh, color) {
				if (mesh.material) mesh.material.alpha = 0;
				mesh.enableEdgesRendering();	
				mesh.edgesWidth = .5;
				mesh.edgesColor = BABYLON.Color4.FromColor3(color);
			},
			
			eraseObjects: function() {

				userAddedObjects.forEach(function(mesh) {
					mesh.dispose();
				});
				
				setTimeout(function() {
					activeTool.setInactive();
				}, 750);
			},
			
			updateTool: function(activeTool) {
				
				let self = this;
				cursor.length = 1;
				if (activeTool === eraseTool) cursor.length = 3;
				else if (activeTool === resetTool) self.eraseObjects();
				else if (activeTool === dragTool) cursor.length = 3;
			},
			
			enableTeleportation: function() {
				// vrHelper.teleportationEnabled = true;
				// vrHelper._rotationAllowed = true;
				
				// vrHelper.teleportationTarget.dispose();
				// vrHelper.teleportationTarget = BABYLON.MeshBuilder.CreateIcoSphere('teleportationTarget', { diameter: .01, subdivisions: 2 }, scene);
				// if (!vrHelper.teleportationTarget.material) vrHelper.teleportationTarget.material = new BABYLON.StandardMaterial('teleportationTargetMaterial', scene);
				
				// vrHelper.teleportationTarget.scaling = new BABYLON.Vector3(.2, .2, .2);
				// vrHelper.teleportationTarget.onBeforeRenderObservable.add(function(object) {
				// 	vrHelper.teleportationTarget.material.alpha = .25;
				// });
				
				// if (vrHelper.teleportationTarget.material) {
				// 	vrHelper.teleportationTarget.material.emissiveColor = new BABYLON.Color3.White;
				// 	vrHelper.teleportationTarget.material.wireframe = true;
				// }
				if (cursor) {
					cursor.material.alpha = 0;
					cursor.edgesColor.a = 0;
				}
			},
			
			disableTeleportation: function() {
				// vrHelper.teleportationEnabled = false;
				// vrHelper._rotationAllowed = false;
				if (cursor && activeTool !== dragTool) cursor.material.alpha = 1;
				if (cursor) cursor.edgesColor.a = 1;
			},
			
			resetDraggedParent: function() {
				draggedObjects.forEach(function(object) {
					cursor.removeChild(object);
					rightController.mesh.addChild(object);
				});
			},
			
			rightJoystickRelease: function() {
				// vrHelper.teleportationTarget.material.alpha = 0;
				joystickActive = false;
				this.resetDraggedParent();
			},
			
			leftJoystickRelease: function() {
				// vrHelper.teleportationTarget.material.alpha = 0;
				joystickActive = false;
				this.resetDraggedParent();
			},
			
			disableWireframe: function(mesh) {
				mesh.disableEdgesRendering();
				if (mesh.material) mesh.material.alpha = 1;
			},
			
			addMenu: function() {
				
				let self = this;
				var light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 5, 0), scene);
				light.intensity = .5;
				
				var boxSize = .5;
				
				laserTool = new MenuItemBlock(new BABYLON.Vector3(-8, 0, 8), 'Laser', menuItems, scene);
				strokeTool = new MenuItemBlock(new BABYLON.Vector3(0, 0, 8), 'Stroke', menuItems, scene);
				lineTool = new MenuItemBlock(new BABYLON.Vector3(8, 0, -8), 'Line', menuItems, scene);
				blockTool = new MenuItemBlock(new BABYLON.Vector3(-8, 0, 0), 'Block', menuItems, scene);
				dragTool = new MenuItemBlock(new BABYLON.Vector3(8, 0, 8), 'Drag', menuItems, scene);
				bubbleTool = new MenuItemBlock(new BABYLON.Vector3(8, 0, 0), 'Bubble', menuItems, scene);
				//saveTool = new MenuItemBlock(new BABYLON.Vector3(8, 0, -8), 'Save', menuItems, scene);
				eraseTool = new MenuItemBlock(new BABYLON.Vector3(-8, 0, -8), 'Erase', menuItems, scene);
				resetTool = new MenuItemBlock(new BABYLON.Vector3(0, 0, -8), 'Reset', menuItems, scene);
			},
			
			saveLoad: function() {},
			
			addButtonEvents: function() {
				
				
				xrHelper.input.onControllerAddedObservable.add((controller) => {
					
					controller.onMotionControllerInitObservable.add((motionController) => {
						
						console.log(motionController.getComponentIds());
						
						if (motionController.handness === 'left') {
							let triggerComponent = motionController.getComponent('xr-standard-trigger');
							triggerComponent.onButtonStateChangedObservable.add((state) => {
								if (triggerComponent.value >= 1) {
									this.buttonLeftBackTrigger(motionController);
								}
								else {
									this.leftTriggerRelease();
								}
							});
							
							let sideTriggerComponent = motionController.getComponent('xr-standard-squeeze');
							sideTriggerComponent.onButtonStateChangedObservable.add((state) => {
								if (sideTriggerComponent.value >= 1) {
									this.buttonLeftSideTrigger(motionController);
									// this.enableTeleportation();
								}
								else {
									this.leftSecondaryTriggerRelease();
								}
							});
							
							let xButton = motionController.getComponent('x-button');
							xButton.onButtonStateChangedObservable.add((state) => {
								this.buttonLeftX(motionController);
							});
							
							let yButton = motionController.getComponent('y-button');
							yButton.onButtonStateChangedObservable.add((state) => {
								this.buttonLeftY(motionController);
							});
						}
						if (motionController.handness === 'right') {
							
							let triggerComponent = motionController.getComponent('xr-standard-trigger');
							triggerComponent.onButtonStateChangedObservable.add((state) => {
								if (triggerComponent.value >= 1) {
									this.buttonRightBackTrigger(motionController, state);
								}
								else {
									this.rightTriggerRelease();
								}
							});
							
							let sideTriggerComponent = motionController.getComponent('xr-standard-squeeze');
							sideTriggerComponent.onButtonStateChangedObservable.add((state) => {
								if (sideTriggerComponent.value >= 1) {
									this.buttonRightSideTrigger(motionController, state);
								}
								else {
									scalingRod.scalingState = false;
									cursor.scalingStartSize = cursor.size;
								}
							});
							
							let aButton = motionController.getComponent('a-button');
							aButton.onButtonStateChangedObservable.add((state) => {});
							
							let bButton = motionController.getComponent('b-button');
							bButton.onButtonStateChangedObservable.add((state) => {});
						}
					});
				});
				
				
				
				
				
				
				
				
				
				// let self = this;

				// vrHelper.onControllerMeshLoadedObservable.add(function(webVRController) {
					
				// 	if (webVRController.hand === 'left') {
				// 		vrHelper._leftController._laserPointer._isEnabled = false;
				// 		vrHelper._leftController._gazeTracker._isEnabled = false;
				// 		leftController = webVRController;
				// 	}
				// 	if (webVRController.hand === 'right') {
				// 		vrHelper._rightController._laserPointer._isEnabled = false;
				// 		rightController = webVRController;
				// 	}
					
				// 	if (leftController && webVRController === leftController) {
						
				// 		leftController.onSecondaryButtonStateChangedObservable.add(function(stateObject) {
				// 			if (stateObject.pressed) {
				// 				self.buttonLeftY(leftController);
				// 			}
				// 		});
				// 		leftController.onMainButtonStateChangedObservable.add(function(stateObject) {
				// 			if (stateObject.pressed) {
				// 				self.buttonLeftX(leftController);
				// 			}
				// 		});
				// 		leftController.onTriggerStateChangedObservable.add(function(stateObject) {
				// 			if (stateObject.value >= 1) {
				// 				self.buttonLeftBackTrigger(leftController);
				// 			}
				// 		});
				// 		leftController.onSecondaryTriggerStateChangedObservable.add(function(stateObject) {
				// 			if (stateObject.value >= 1) {
				// 				self.buttonLeftSideTrigger(leftController, stateObject);
				// 				self.enableTeleportation();
				// 			}
				// 			else {
				// 				self.leftSecondaryTriggerRelease();
				// 			}
				// 		});
				// 		leftController.onPadValuesChangedObservable.add(function(stateObject) {
							
				// 			if (stateObject.y > 0 || stateObject.y < 0) {
				// 				joystickActive = true;
				// 				self.joystickLeft(leftController, stateObject);
				// 				self.addjustCursorLength(stateObject);
				// 			}
				// 			else {
				// 				self.leftJoystickRelease();
				// 			}
				// 		});
				// 	}
					
				// 	if (rightController && webVRController === rightController) {
						
				// 		rightController.onSecondaryButtonStateChangedObservable.add(function(stateObject) {
				// 			if (stateObject.pressed) {
				// 				self.buttonRightB(rightController, stateObject);
				// 				rightBActive = true;
				// 				if (activeTool === strokeTool) stroke.addingState = true;
				// 			}
				// 			else {
				// 				rightBActive = false;
				// 				self.resetStroke();
				// 			}
				// 		});
				// 		rightController.onMainButtonStateChangedObservable.add(function(stateObject) {
				// 			if (stateObject.pressed) {
				// 				self.buttonRightA(rightController);
				// 			}
				// 			else {
				// 				self.buttonRightARelease(rightController);
				// 			}
				// 		});
				// 		rightController.onTriggerStateChangedObservable.add(function(stateObject) {
							
				// 			if (activeTool === dragTool) {
				// 				if (stateObject.value >= .9) { // grab
									
				// 					userAddedObjects.forEach(function(object) {
				// 						if (object.intersectsMesh(cursor, true) && object.draggable) {
				// 							object.dragging = true;
				// 							rightController.mesh.addChild(object);
				// 						}
				// 					});
				// 					dragging = true;
				// 					cursor.edgesColor.a = 0;
				// 				}
				// 				else { // ungrab 
				// 					userAddedObjects.forEach(function(object) {
				// 						object.dragging = false;
				// 						rightController.mesh.removeChild(object);
				// 					});
				// 					cursor.edgesColor.a = 1;
				// 				}
				// 			}
							
				// 			if (stateObject.value >= 1) {
				// 				self.buttonRightBackTrigger(rightController, stateObject);
				// 			}
				// 			else {
				// 				self.rightTriggerRelease();
				// 			}
				// 		});
				// 		rightController.onSecondaryTriggerStateChangedObservable.add(function(stateObject) {
				// 			if (stateObject.value >= 1) {
				// 				self.buttonRightSideTrigger(rightController, stateObject);
				// 			}
				// 			else {
				// 				scalingRod.scalingState = false;
				// 				cursor.scalingStartSize = cursor.size;
				// 			}
				// 		});
				// 		rightController.onPadValuesChangedObservable.add(function(stateObject) {
							
				// 			rightJoystick = stateObject;
							
				// 			if (stateObject.y > 0 || stateObject.y < 0) {
				// 				joystickActive = true;
				// 				self.joystickRight(rightController, stateObject);
				// 				self.addjustCursorLength(stateObject);
				// 			}
				// 			else {
				// 				self.rightJoystickRelease();
				// 			}
				// 		});
				// 	}
					
				// 	self.addCursor();
				// });
			},
			
			addjustCursorLength: function(stateObject) {
				
				if ((activeTool === blockTool || activeTool === bubbleTool || activeTool === strokeTool || activeTool === lineTool || activeTool === laserTool || activeTool === eraseTool || activeTool === dragTool)) { // add && !vrHelper.teleportationEnabled after converting vrHelper to xrHelper
					
					if (stateObject.y > .85 && cursor.length > .1) { // high speed
						cursor.speed = -.05;
						cursor.length += cursor.speed;
					}
					if (stateObject.y < -.85) {
						cursor.length += cursor.speed;
					}
					if (stateObject.y > 0.7 && cursor.length > .1) { // med speed
						cursor.speed = -.03;
						cursor.length += cursor.speed;
					}
					if (stateObject.y < -0.7) {
						cursor.speed = .03;
						cursor.length += .03;
					}
					if (stateObject.y > 0.6 && cursor.length > .1) { // med lo speed
						cursor.speed = -.02;
						cursor.length += cursor.speed;
					}
					if (stateObject.y < -0.6) {
						cursor.speed = .02;
						cursor.length += cursor.speed;
					}
					if (stateObject.y > 0.4 && cursor.length > .1) { // low speed
						cursor.speed = -.01;
						cursor.length += cursor.speed;
					}
					if (stateObject.y < -0.4) {
						cursor.speed = .01;
						cursor.length += cursor.speed;
					}
					if (stateObject.y > 0.2 && cursor.length > .1) { // fine tune
						cursor.speed = -.001;
						cursor.length += cursor.speed;
					}
					if (stateObject.y < -0.2) {
						cursor.speed = .001;
						cursor.length += cursor.speed;
					}
					if (stateObject.y === 0) {
						cursor.speed = 0;
					}
					
					if (dragging) {
						
						draggedObjects = [];
						userAddedObjects.forEach(function(object) {
							if (object.dragging) {
								
								if (joystickActive) {
									draggedObjects.push(object);
									rightController.mesh.removeChild(object);
									cursor.addChild(object);
								}
							}
						});
					}
				}
			},
			
			addColorpicker: function() {
				
				for (let i = 0; i < 4; i++) {
					
					let x, z, rotate;
					if (i === 0) { x = 0; z = 9; rotate = 0; }
					else if (i === 1) { x = 0; z = -9; rotate = Math.PI; }
					else if (i === 2) { x = 9; z = 0; rotate = Math.PI/2; }
					else if (i === 3) { x = -9; z = 0; rotate = 3*Math.PI/2; }
					
					let colorpickerSize = 6;
					let colorpickerPlane = BABYLON.Mesh.CreatePlane('colorpickerPlane', colorpickerSize, scene);
					colorpickerPlane.rotate(BABYLON.Axis.Y, rotate, BABYLON.Space.WORLD);
					colorpickerPlane.material = new BABYLON.StandardMaterial('wallMat', scene);
					
					colorpickerPlane.position = new BABYLON.Vector3(x, colorpickerSize/2 + 1, z);
					
					var colorpickerTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(colorpickerPlane, 1024, 1024);
					
					var panel = new BABYLON.GUI.StackPanel();
					panel.width = '1024px';
					panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
					panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
					colorpickerTexture.addControl(panel);
		
					var picker = new BABYLON.GUI.ColorPicker();
					picker.height = '1000px';
					picker.width = '1000px';
					picker.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
					picker.onValueChangedObservable.add(function(color) {
						activeColor = color;
						// vrHelper.setLaserColor(activeColor);
						// vrHelper.setLaserLightingState(false);
						if (cursor && activeTool !== dragTool && activeTool !== eraseTool) cursor.material.emissiveColor = activeColor;
					});
		
					panel.addControl(picker);
					
					colorpickerPlane.material.alpha = 0;
					colorpickerPlane.isPickable = false;
					colorpickers.push(colorpickerPlane);
					pickers.push(picker);
					
					picker.value = {r: 0, g: 1, b: 0};
					picker.onValueChangedObservable.add(function(color) {
						
						pickers.forEach(function(thisPicker) {
							thisPicker.value = color;
						});
					});
				}
			},
			
			buttonLeftY: function(leftController) {},
			buttonLeftX: function(leftController) {},
			buttonRightA: function(rightController) {
				colorpickers.forEach(function(colorpicker) {
					colorpicker.isPickable = true;
					colorpicker.material.alpha = 1;
				});
			},
			
			buttonRightARelease: function(rightController) {
				colorpickers.forEach(function(colorpicker) {
					colorpicker.isPickable = false;
					colorpicker.material.alpha = 0;
				});
			},
			
			buttonRightB: function(rightController) {
				
				let self = this;
				if (activeTool === laserTool) {
					userAddedObjects.push(gfx.createLineArt(rightController.devicePosition, cursor.position, activeColor));
				}
				if (activeTool === lineTool) {
					line = gfx.createUserLine(rightController, activeTool, line, cursor, activeColor);
					if (line.mesh) userAddedObjects.push(line.mesh);
				}
				if (activeTool === blockTool) userAddedObjects.push(gfx.createUserBlock(rightController, activeColor, cursor));
				if (activeTool === bubbleTool) userAddedObjects.push(gfx.createSphere(rightController, activeColor, cursor));
				if (activeTool === eraseTool){
					
					userAddedObjects.forEach(function(object) {
						if (object.intersectsMesh(cursor, true)) object.dispose();
					});
				}
			},
			buttonLeftBackTrigger: function(leftController) {},
			buttonRightBackTrigger: function(rightController, state) {},
			rightTriggerRelease: function() {
				
				dragging = false;
				draggedObjects = [];
				if (activeTool) activeTool.selecting = false;
				menuItems.forEach(function(menuItem) {
					menuItem.setSubMenuInactive();
				});
				userAddedObjects.forEach(function(mesh) {
					if (mesh && rightController.mesh) rightController.mesh.removeChild(mesh);
				});
			},
			leftSecondaryTriggerRelease: function() {
				
				// vrHelper.teleportationTarget.dispose();
				this.disableTeleportation();
			},
			buttonLeftSideTrigger: function(leftController) {},
			buttonRightSideTrigger: function(rightController, stateObject) {
				
				console.log('right side trigger pressed');
				
				scalingRod.scalingState = true;
				scalingRod.initialLength = gfx.createVector(leftController.devicePosition, rightController.devicePosition).length();
				cursor.scalingStartSize = cursor.size;
			},
			joystickLeft: function(leftController, stateObject) {},
			joystickRight: function(rightController, stateObject) {
				this.addjustCursorLength(stateObject);
			},
			
			setLighting: function() {
				
				scene.clearColor = new BABYLON.Color3.Black;
				var directionalLight = new BABYLON.DirectionalLight('DirectionalLight', new BABYLON.Vector3(0, -1, 0), scene);
				directionalLight.diffuse = new BABYLON.Color3(.4, .4, .4);
				directionalLight.specular = new BABYLON.Color3(0, 0, .1);
				var spotLight = new BABYLON.SpotLight('spotLight', new BABYLON.Vector3(0, 10, 0), new BABYLON.Vector3(0, -1, 0), Math.PI / 3, 2, scene);
				spotLight.diffuse = new BABYLON.Color3(.1, .1, .1);
				spotLight.specular = new BABYLON.Color3(.1, .1, .1);

				ground = BABYLON.MeshBuilder.CreateGround('ground', { height: 20, width: 20, subdivisions: 4, isPickable: false }, scene);
				ground.material = new BABYLON.StandardMaterial('groundMaterial', scene);
				ground.material.emissiveColor = new BABYLON.Color3(1, 1, 1);
				ground.material.alpha = .05;
				
				var dome = new BABYLON.PhotoDome('starsBackdrop', '/assets/img/stars.jpg', {
					resolution: 32,
					size: 2000
				}, scene);
			},
			
			showBabylonDebugger: function() {
				
				scene.debugLayer.show({
					overlay: true
				});
			}
		}
	};
</script>

<style scoped>
	canvas {
		width: 100%;
		position: fixed;
		height: 100vh;
	}
</style>