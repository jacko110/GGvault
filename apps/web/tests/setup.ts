import '@testing-library/jest-dom';
Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
  value: function () {
    this.setAttribute('open', '');
  },
});
Object.defineProperty(HTMLDialogElement.prototype, 'close', {
  value: function () {
    this.removeAttribute('open');
  },
});
