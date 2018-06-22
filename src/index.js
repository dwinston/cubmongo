import * as THREE from 'three';
import OrbitControls from 'orbit-controls-es6';

class StructureViewer {

	makeCrystal(crystal_json) {

		if (typeof crystal_json !== 'undefined') {


			const crystal = new THREE.Object3D();
			crystal.name = 'crystal';
			crystal.castsShadow = true;
			crystal.receivesShadow = true;

			const atoms = this.makeAtoms(crystal_json)
			crystal.add(atoms)

			const bonds = this.makeBonds(crystal_json, atoms)
			crystal.add(bonds)

			const unit_cell = this.makeUnitCell(crystal_json)
			crystal.add(unit_cell)

			const polyhedra = this.makePolyhedra(crystal_json, atoms)
			crystal.add(polyhedra)

			return crystal

		}

	}

	static getMaterial(color) {
		return new THREE.MeshPhongMaterial({
			color: color,
			shininess: 1,
			reflectivity: 1,
			specular: 0xffffff
		});
	}

	makeAtoms(crystal_json) {

		const scale = 0.5;

		const atoms = new THREE.Object3D();
		atoms.name = 'atoms';

		crystal_json.atoms.forEach(function(atom) {
			const radius = atom.fragments[0].radius * scale;
			const geometry = new THREE.SphereGeometry(radius, 32, 32);
			const color = new THREE.Color(...atom.fragments[0].color);
			const material = StructureViewer.getMaterial(color);
			const sphere = new THREE.Mesh(geometry, material);
			sphere.position.set(...atom.position)
			atoms.add(sphere);
		});

		return atoms;
	}

	makeBonds(crystal_json, atoms) {

		const bonds = new THREE.Object3D();
		bonds.name = 'bonds';

		crystal_json.bonds.forEach(function(bond) {

			const sourceObj = atoms.children[bond.from_atom_index]
			const destinationObj = atoms.children[bond.to_atom_index]

			var midPoint = destinationObj.position.clone().sub(sourceObj.position);
			const len = midPoint.length();
			midPoint = midPoint.multiplyScalar(0.5);
			midPoint = sourceObj.position.clone().add(midPoint)

			const geometry = new THREE.CylinderGeometry(0.1, 0.1, len / 2, 16, 1);

			geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, len / 4, 0));
			geometry.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));

			const material_from = StructureViewer.getMaterial(atoms.children[bond.from_atom_index].material.color);

			const cylinder_from = new THREE.Mesh(geometry, material_from);

			cylinder_from.translateX(sourceObj.position.x);
			cylinder_from.translateY(sourceObj.position.y);
			cylinder_from.translateZ(sourceObj.position.z);

			cylinder_from.lookAt(midPoint);

			const material_to = StructureViewer.getMaterial(atoms.children[bond.to_atom_index].material.color);

			const cylinder_to = new THREE.Mesh(geometry, material_to);
			cylinder_to.translateX(destinationObj.position.x);
			cylinder_to.translateY(destinationObj.position.y);
			cylinder_to.translateZ(destinationObj.position.z);

			cylinder_to.lookAt(midPoint);

			bonds.add(cylinder_from);
			bonds.add(cylinder_to);

		})

		return bonds;

	}

	makeUnitCell(crystal_json) {

		const edges = new THREE.Geometry();
		crystal_json.unit_cell.lines.map(p => edges.vertices.push(new THREE.Vector3(...p)))

		const unitcell = new THREE.LineSegments(edges,
			new THREE.LineBasicMaterial({
				color: 0x0,
				linewidth: 1
			}));
		unitcell.name = 'unitcell';

		return unitcell
	}

	makePolyhedra(crystal_json, atoms) {

		const polyhedra = new THREE.Object3D();
		polyhedra.name = 'polyhedra';

		this.available_polyhedra = crystal_json.polyhedra.polyhedra_types
		this.default_polyhedra = crystal_json.polyhedra.default_polyhedra_types

		for (var polyhedron_type in crystal_json.polyhedra.polyhedra_by_type) {

		    const polyhedra_type_object = new THREE.Object3D();
		    polyhedra_type_object.name = polyhedron_type;

		    crystal_json.polyhedra.polyhedra_by_type[polyhedron_type].forEach(function(polyhedron) {

			    const polyhedron_geometry = new THREE.Geometry();
			    polyhedron.points.map(p => polyhedron_geometry.vertices.push(new THREE.Vector3(...p)))
			    polyhedron.hull.map(p => polyhedron_geometry.faces.push(new THREE.Face3(...p)))
			    polyhedron_geometry.computeFaceNormals();

			    const polyhedron_color = atoms.children[polyhedron.center].material.color;
			    const polyhedron_material = StructureViewer.getMaterial(polyhedron_color);
                polyhedron_material.side = THREE.DoubleSide;

			    const polyhedron_object = new THREE.Mesh(polyhedron_geometry, polyhedron_material)

			    polyhedra_type_object.add(polyhedron_object)

			})

            polyhedra.add(polyhedra_type_object);

		}

		return polyhedra

	}

	constructor(crystal_json, dom_elt) {

		this.start = this.start.bind(this)
		this.stop = this.stop.bind(this)
		this.animate = this.animate.bind(this)

		// This is where all the Three.js scene construction happens

		const width = dom_elt.clientWidth
		const height = dom_elt.clientHeight

		const scene = new THREE.Scene()
		const camera = new THREE.OrthographicCamera(
			width / -2,
			width / 2,
			height / 2,
			height / -2, -2000, 2000);

		camera.position.z = 2;

		const renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true
		})

		renderer.setPixelRatio(window.devicePixelRatio * 1.5);
		renderer.setClearColor(0xffffff, 0)
		renderer.setSize(width, height)

		// Lighting

		const ambientLight = new THREE.AmbientLight(0xffffff, 0.002);
		scene.add(ambientLight)

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.0015);
		directionalLight.position.set(-1, 1, 1).normalize();
		scene.add(directionalLight);

		const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x222222, 0.0015);
		scene.add(hemisphereLight)

		//const pointLight = new THREE.PointLight(0xffffff, 0.05);
		//camera.add(pointLight)
        //const pointLightHelper = new THREE.PointLightHelper( pointLight, 1, 0xff0000 );
        //scene.add( pointLightHelper );

		scene.add(camera)

		if (typeof crystal_json !== 'undefined') {

			const crystal = this.makeCrystal(crystal_json);

			scene.add(crystal);
			camera.lookAt(crystal.position);
			directionalLight.target = crystal;

			const box = new THREE.Box3();
			box.setFromObject(crystal);
			camera.zoom = Math.min(width / (box.max.x - box.min.x),
				height / (box.max.y - box.min.y)) * 0.6;
			camera.updateProjectionMatrix();
			camera.updateMatrix();

			this.crystal = crystal;
		}

		this.scene = scene
		this.camera = camera
		this.renderer = renderer

		// Controls
		const controls = new OrbitControls(camera, this.renderer.domElement);

		dom_elt.appendChild(this.renderer.domElement)
		this.start();

	}

	start() {
		if (!this.frameId) {
			this.frameId = requestAnimationFrame(this.animate)
		}
	}

	stop() {
		cancelAnimationFrame(this.frameId)
	}

	animate() {
		this.crystal.rotation.y += 0.002;
		this.renderScene()
		this.frameId = window.requestAnimationFrame(this.animate)
	}

	renderScene() {
		this.renderer.render(this.scene, this.camera)
	}
}

window.StructureViewer = StructureViewer
