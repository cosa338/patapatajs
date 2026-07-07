
import { attrString } from '../core/utils.ts';

interface ControllableTarget extends HTMLElement {
  start?: () => void;
  stop?: () => void;
  reset?: () => void;
  toggle?: () => void;
}

class PatapataControlElement extends HTMLElement {
  static get observedAttributes() {
    return ['for', 'action', 'start', 'stop', 'reset', 'toggle', 'disabled'];
  }

  _onClick: ((e: MouseEvent) => void) | null;
  _onKeyDown: ((e: KeyboardEvent) => void) | null;
  _enabledTabIndex: string | null | undefined;

  constructor() {
    super();
    this._onClick = null;
    this._onKeyDown = null;
    this._enabledTabIndex = undefined;
  }

  connectedCallback() {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this._syncDisabledState();

    this._onClick = (e) => {
      if (this.hasAttribute('disabled')) return;
      e.preventDefault();
      this._performAction();
    };
    this.addEventListener('click', this._onClick);

    this._onKeyDown = (e) => {
      if (this.hasAttribute('disabled')) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      this._performAction();
    };
    this.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback() {
    if (this._onClick) this.removeEventListener('click', this._onClick);
    if (this._onKeyDown) this.removeEventListener('keydown', this._onKeyDown);
    this._onClick = null;
    this._onKeyDown = null;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    if (name === 'disabled') this._syncDisabledState();
  }

  _syncDisabledState() {
    if (this.hasAttribute('disabled')) {
      if (this._enabledTabIndex === undefined) this._enabledTabIndex = this.getAttribute('tabindex');
      this.setAttribute('aria-disabled', 'true');
      this.tabIndex = -1;
      return;
    }

    this.removeAttribute('aria-disabled');
    if (this._enabledTabIndex !== undefined) {
      if (this._enabledTabIndex == null) this.tabIndex = 0;
      else this.setAttribute('tabindex', this._enabledTabIndex);
      this._enabledTabIndex = undefined;
    } else if (!this.hasAttribute('tabindex')) {
      this.tabIndex = 0;
    }
  }

  _resolveAction() {
    if (this.hasAttribute('start')) return 'start';
    if (this.hasAttribute('stop')) return 'stop';
    if (this.hasAttribute('reset')) return 'reset';
    if (this.hasAttribute('toggle')) return 'toggle';
    const a = attrString(this, 'action');
    if (a) return a;
    return 'toggle';
  }

  _resolveTarget(): ControllableTarget | null {
    const id = attrString(this, 'for');
    if (!id) return null;
    return document.getElementById(id);
  }

  _performAction() {
    const target = this._resolveTarget();
    const action = this._resolveAction() as keyof ControllableTarget;
    if (!target) return;
    const fn = target[action];
    if (typeof fn === 'function') fn.call(target);
  }
}

export { PatapataControlElement };
