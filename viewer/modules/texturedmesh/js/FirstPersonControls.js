import {
    EventDispatcher,
    MathUtils,
    Vector3
} from '/viewer/modules/pointcloud/libs/three.js/build/three.module.js';

const _direction = new Vector3();
const _right = new Vector3();
const _up = new Vector3(0, 1, 0);

class FirstPersonControls extends EventDispatcher {
    constructor(object, domElement = null) {
        super();

        this.object = object;
        this.domElement = domElement;

        this.enabled = true;
        this.activeLook = true;
        this.movementSpeed = 1.0;
        this.lookSpeed = 0.002;
        this.constrainVertical = true;
        this.verticalMin = -85;
        this.verticalMax = 85;

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.moveUp = false;
        this.moveDown = false;
        this.isLooking = false;

        this._onContextMenu = (event) => event.preventDefault();
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);

        this.object.rotation.order = 'YXZ';

        if (this.domElement) {
            this.connect(this.domElement);
        }
    }

    connect(element = this.domElement) {
        this.disconnect();
        this.domElement = element;

        if (!this.domElement) {
            return;
        }

        this.domElement.tabIndex = this.domElement.tabIndex >= 0 ? this.domElement.tabIndex : 0;
        this.domElement.style.touchAction = 'none';
        this.domElement.addEventListener('contextmenu', this._onContextMenu);
        this.domElement.addEventListener('pointerdown', this._onPointerDown);
        this.domElement.addEventListener('pointermove', this._onPointerMove);
        this.domElement.addEventListener('pointerup', this._onPointerUp);
        this.domElement.addEventListener('pointercancel', this._onPointerUp);
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    disconnect() {
        if (!this.domElement) {
            return;
        }

        this.domElement.removeEventListener('contextmenu', this._onContextMenu);
        this.domElement.removeEventListener('pointerdown', this._onPointerDown);
        this.domElement.removeEventListener('pointermove', this._onPointerMove);
        this.domElement.removeEventListener('pointerup', this._onPointerUp);
        this.domElement.removeEventListener('pointercancel', this._onPointerUp);
        this.domElement.style.touchAction = '';
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }

    dispose() {
        this.disconnect();
    }

    lookAt(target) {
        this.object.lookAt(target);
        return this;
    }

    reset() {
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.moveUp = false;
        this.moveDown = false;
        this.isLooking = false;
    }

    update(delta) {
        if (!this.enabled) {
            return;
        }

        const actualMoveSpeed = delta * this.movementSpeed;

        this.object.getWorldDirection(_direction);
        _right.crossVectors(_direction, _up).normalize();

        if (this.moveForward) this.object.position.addScaledVector(_direction, actualMoveSpeed);
        if (this.moveBackward) this.object.position.addScaledVector(_direction, -actualMoveSpeed);
        if (this.moveRight) this.object.position.addScaledVector(_right, actualMoveSpeed);
        if (this.moveLeft) this.object.position.addScaledVector(_right, -actualMoveSpeed);
        if (this.moveUp) this.object.position.y += actualMoveSpeed;
        if (this.moveDown) this.object.position.y -= actualMoveSpeed;
    }

    _onPointerDown(event) {
        if (!this.enabled) {
            return;
        }

        this.domElement.focus();
        this.isLooking = true;
        this.domElement.setPointerCapture(event.pointerId);
    }

    _onPointerMove(event) {
        if (!this.enabled || !this.activeLook || !this.isLooking) {
            return;
        }

        this.object.rotation.y -= event.movementX * this.lookSpeed;
        this.object.rotation.x -= event.movementY * this.lookSpeed;

        if (this.constrainVertical) {
            this.object.rotation.x = MathUtils.clamp(
                this.object.rotation.x,
                MathUtils.degToRad(this.verticalMin),
                MathUtils.degToRad(this.verticalMax)
            );
        }
    }

    _onPointerUp(event) {
        if (!this.enabled) {
            return;
        }

        this.isLooking = false;
        if (this.domElement.hasPointerCapture(event.pointerId)) {
            this.domElement.releasePointerCapture(event.pointerId);
        }
    }

    _onKeyDown(event) {
        if (!this.enabled) {
            return;
        }

        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = true;
                break;
            case 'KeyR':
            case 'Space':
                this.moveUp = true;
                break;
            case 'KeyF':
            case 'ShiftLeft':
            case 'ShiftRight':
                this.moveDown = true;
                break;
        }
    }

    _onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = false;
                break;
            case 'KeyR':
            case 'Space':
                this.moveUp = false;
                break;
            case 'KeyF':
            case 'ShiftLeft':
            case 'ShiftRight':
                this.moveDown = false;
                break;
        }
    }
}

export { FirstPersonControls };
