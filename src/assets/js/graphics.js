import * as BABYLON from 'babylonjs';
import * as Utils from '@/assets/js/utils.js'; let utils = Utils.default;

let gfx = (function () {

	var appSettings;
	var scene;
		
	return {

		appSettings: {
			activateLightHelpers: false,
			axesHelper: {
				activateAxesHelper: false,
				axisLength: 10
			},
			font: {
				enable: true,
				fontStyle: {
					font: null,
					size: .75,
					height: 0,
					curveSegments: 1
				}
			},
			errorLogging: false
		},

		createVector: function(pt1, pt2) {
			return new BABYLON.Vector3(pt2.x - pt1.x, pt2.y - pt1.y, pt2.z - pt1.z);
		},
		
		createLine: function(origin, vector, color) {
		
			color = color || new BABYLON.Color3(1, 1, 1);
			color = BABYLON.Color4.FromColor3(color);
			return BABYLON.MeshBuilder.CreateLines('lines', {
				points: [origin, gfx.movePoint(origin, vector)],
				colors: [color, color],
				updatable: true
			}, scene);
		},
		
		createLineFromPoints: function(pt1, pt2, color) {
		
			color = color || new BABYLON.Color3(1, 1, 1);
			color = BABYLON.Color4.FromColor3(color);
			return BABYLON.MeshBuilder.CreateLines('lines', {
				points: [pt1, pt2],
				colors: [color, color]
			}, scene);
		},
		
		createLineArt: function(pt1, pt2, color) {
			let line = gfx.createLineFromPoints(pt1, pt2, color);
			line.userAdded = true;
			line.draggable = true;
			return line;
		},
		
		createLineGhost: function(ghost, cursor, color) {
			ghost.mesh = gfx.createLineFromPoints(ghost.start, cursor.position, color);
			ghost.mesh.isPickable = false;
			return ghost;
		},
		
		createUserBlock: function(webVRController, color, cursor) {
			var box = BABYLON.MeshBuilder.CreateBox('userCreatedBox', {size: cursor.size}, scene);
			box.userAdded = true;
			box.draggable = true;
			box.position = cursor.position;
			box.material = new BABYLON.StandardMaterial('boxMat', scene);
			box.material.emissiveColor = color.clone();
			box.material.alpha = .7;
			return box;
		},
		
		createUserLine: function(controller, activeTool, line, cursor, color) {
			line.color = color;
			if (line.addingState) {
				line.end = cursor.position;
				
				if (activeTool.mode === 'ribbon') {
					var path1;
					var path2;
					path1 = [];
					path2 = [];
					
					path1.push(gfx.movePoint(line.start, new BABYLON.Vector3(0, -.05, 0)));
					path2.push(gfx.movePoint(line.start, new BABYLON.Vector3(0, .05, 0)));
					
					path1.push(gfx.movePoint(line.end, new BABYLON.Vector3(0, -.05, 0)));
					path2.push(gfx.movePoint(line.end, new BABYLON.Vector3(0, .05, 0)));
					
					line.mesh = BABYLON.MeshBuilder.CreateRibbon('ribbon', {pathArray: [path1, path2], sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
					line.mesh.material = new BABYLON.StandardMaterial('lineMat', scene);
					line.mesh.material.ambientTexture = new BABYLON.Texture('/assets/img/grass.png', scene);
					line.mesh.material.diffuseColor = color.clone();
					line.mesh.material.emissiveColor = color.clone();
				}
				else if (activeTool.mode === 'line') {
					line.mesh = gfx.createLineArt(line.start, line.end, line.color);
				}
				line.mesh.userAdded = true;
				line.mesh.draggable = true;
				line.addingState = false;
			}
			else { // alternate
				line.start = cursor.position;
				line.addingState = true;
			}
			return line;
		},
		
		createUserStroke: function(controller, activeTool, stroke, cursor, color) {

			if (!stroke.path.length) {
				stroke.path.push(cursor.position.clone());
				stroke.colors = [];
				stroke.colors.push(BABYLON.Color4.FromColor3(color));
			}
			
			if (!stroke.path1) {
				stroke.path1 = [], stroke.path2 = [];
				stroke.path1.push(gfx.movePoint(cursor.position, new BABYLON.Vector3(0, .05, 0)));
				stroke.path2.push(gfx.movePoint(cursor.position, new BABYLON.Vector3(0, -.05, 0)));
				stroke.colors = [];
				stroke.colors.push(BABYLON.Color4.FromColor3(color));
			}
			
			if (activeTool.mode === 'line') {
				
				// Check if we should add a new point
				let shouldAddPoint = false;
				if (stroke.path.length < 2) {
					shouldAddPoint = true;
				}
				else if (gfx.createVector(cursor.position, stroke.path[stroke.path.length-1]).length() > .05) {
					shouldAddPoint = true;
				}
				
				if (shouldAddPoint) {
					stroke.path.push(cursor.position.clone());
					stroke.colors.push(BABYLON.Color4.FromColor3(color));
				}
				
				// Create material once and reuse it
				if (!stroke.material) {
					stroke.material = new BABYLON.StandardMaterial('strokeMaterial', scene);
					stroke.material.emissiveColor = color.clone();
					// Disable lighting for consistent color rendering
					stroke.material.disableLighting = true;
					// Set material properties to prevent rendering artifacts
					stroke.material.specularColor = new BABYLON.Color3(0, 0, 0);
					stroke.material.diffuseColor = new BABYLON.Color3(0, 0, 0);
					// Ensure proper rendering
					stroke.material.backFaceCulling = false;
				}
				
				// Recreate mesh when path changes (but keep material)
				// This is necessary because line meshes can't be easily updated without breaking raycasting
				const wasAdded = stroke.mesh && stroke.meshAdded;
				const oldMesh = stroke.mesh;
				
				if (stroke.mesh) {
					stroke.mesh.dispose();
				}
				
				stroke.mesh = BABYLON.MeshBuilder.CreateLines('userAddedStroke', {
					points: stroke.path,
					updatable: true,
					colors: stroke.colors
				}, scene);
				stroke.mesh.material = stroke.material;
				stroke.mesh.userAdded = true;
				stroke.mesh.draggable = true;
				// Make stroke non-pickable to avoid raycasting issues with line geometry
				stroke.mesh.isPickable = false;
				// Store the path points on the mesh for erase detection
				// Make sure we store actual Vector3 clones
				stroke.mesh._strokePath = stroke.path.map(function(p) {
					if (p instanceof BABYLON.Vector3) {
						return p.clone();
					} else if (p && p.x !== undefined && p.y !== undefined && p.z !== undefined) {
						return new BABYLON.Vector3(p.x, p.y, p.z);
					}
					return p;
				});
				// Preserve the meshAdded flag if it was already added
				if (wasAdded) {
					stroke.meshAdded = true;
					// Update the reference in userAddedObjects if it exists
					// Note: This assumes userAddedObjects is accessible - it should be in the component scope
					// We'll need to handle this in the component that calls this function
					stroke.mesh._needsArrayUpdate = true;
					stroke.mesh._oldMeshRef = oldMesh;
				}
				
				// Update material color if it changed
				if (!stroke.material.emissiveColor.equals(color)) {
					stroke.material.emissiveColor = color.clone();
				}
			}
			else if (activeTool.mode === 'ribbon') {
				
				stroke.path1.push(gfx.movePoint(cursor.position, new BABYLON.Vector3(0, .05, 0)));
				stroke.path2.push(gfx.movePoint(cursor.position, new BABYLON.Vector3(0, -.05, 0)));
				stroke.colors.push(BABYLON.Color4.FromColor3(color));
				
				// Create material once and reuse it
				if (!stroke.material) {
					stroke.material = new BABYLON.StandardMaterial('strokeMaterial', scene);
					stroke.material.ambientTexture = new BABYLON.Texture('/assets/img/grass.png', scene);
					stroke.material.diffuseColor = color.clone();
					stroke.material.emissiveColor = color.clone();
				}
				
				// Recreate ribbon mesh when path changes (but keep material)
				if (stroke.mesh) {
					stroke.mesh.dispose();
				}
				
				stroke.mesh = BABYLON.MeshBuilder.CreateRibbon('userAddedStrokeRibbon', {
					pathArray: [stroke.path1, stroke.path2], 
					sideOrientation: BABYLON.Mesh.DOUBLESIDE,
					updatable: true
				}, scene);
				stroke.mesh.material = stroke.material;
				stroke.mesh.userAdded = true;
				stroke.mesh.draggable = true;
				// Make stroke non-pickable to avoid raycasting issues
				stroke.mesh.isPickable = false;
				
				// Update material colors if they changed
				if (!stroke.material.diffuseColor.equals(color)) {
					stroke.material.diffuseColor = color.clone();
				}
				if (!stroke.material.emissiveColor.equals(color)) {
					stroke.material.emissiveColor = color.clone();
				}
			}
			
			return stroke;
		},
		
		createSphere: function(webVRController, color, cursor) {
			
			var bubble = BABYLON.MeshBuilder.CreateSphere('userCreatedBubble', {diameter: cursor.size}, scene);
			bubble.userAdded = true;
			bubble.draggable = true;
			bubble.position = cursor.position;
			bubble.material = new BABYLON.StandardMaterial('bubbleMat', scene);
			bubble.material.emissiveColor = color.clone();
			bubble.material.alpha = .7;
			return bubble;
		},
		
		getMagnitude: function(vector) {
			let magnitude = Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2) + Math.pow(vector.z, 2));
			return magnitude;
		},

		getMidpoint: function(pt1, pt2) {
		
			let midpoint = new BABYLON.Vector3();
			midpoint.x = (pt1.x + pt2.x) / 2;
			midpoint.y = (pt1.y + pt2.y) / 2;
			midpoint.z = (pt1.z + pt2.z) / 2;
			return midpoint;
		},

		setScene: function(thisScene) {
			scene = thisScene;
			return scene;
		},

		showPoint: function(pt, color) {
			color = color || new BABYLON.Color3(0, 1, 0);
			var box = BABYLON.MeshBuilder.CreateBox('box', {size: .02}, scene);
			box.position = new BABYLON.Vector3(.25, 1, .25);
			box.material = new BABYLON.StandardMaterial('boxMaterial', scene);
			box.material.emissiveColor = color;
			return box;
		},
		
		updateArrow: function(arrow, origin, newDirection) {
			let direction = gfx.createVector(origin, newDirection);
			arrow.setDirection(direction);
			arrow.setLength(direction.length()); // Why?
			return arrow;
		},

		getDistance: function(pt1, pt2) { // create point class?
		
			let squirt = Math.pow((pt2.x - pt1.x), 2) + Math.pow((pt2.y - pt1.y), 2) + Math.pow((pt2.z - pt1.z), 2);
			return Math.sqrt(squirt);
		},

		resizeRendererOnWindowResize: function(renderer, camera) {

			window.addEventListener('resize', utils.debounce(function() {
				
				if (renderer) {
	
					camera.aspect = window.innerWidth / window.innerHeight;
					camera.updateProjectionMatrix();
					renderer.setSize(window.innerWidth, window.innerHeight);
				}
			}, 250));
		},

		enableStats: function(stats) {
			document.body.appendChild(stats.dom);
		},
		
		movePoint: function(pt, vec) {
			return new BABYLON.Vector3(pt.x + vec.x, pt.y + vec.y, pt.z + vec.z);
		},
		
		nextVertex: function(currentVertex, geometry) {
		
			let vertexIndex = geometry.vertices.findIndex(function(element) {
				return element === currentVertex;
			});
			return geometry.vertices[(vertexIndex + 1) % geometry.vertices.length];
		},

		getAngleBetweenVectors: function(vector1, vector2) {

			let dot = BABYLON.Vector3.Dot(vector1, vector2);
			return Math.acos(dot / (vector1.length() * vector2.length()));
		}
	}
})();

export default gfx;