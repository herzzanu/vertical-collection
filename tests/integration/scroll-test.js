import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import Ember from 'ember';

import getNumbers from 'dummy/lib/get-numbers';
import wait from 'dummy/tests/helpers/wait';

moduleForComponent('vertical-collection', 'Integration | Scroll Tests', {
  integration: true
});

test('Scroll to last item when actual item sizes are significantly larger than default item size.', function(assert) {
  assert.expect(1);

  this.set('items', new Array(50).fill({ text: 'b' }));

  this.render(hbs`
  <div style="height: 200px; width: 100px;" class="scrollable">
    {{#vertical-collection ${'items'}
      minHeight=10
      alwaysRemeasure=true

      as |item i|}}
      <div style="height: 100px;">{{item.text}} {{i}}</div>
    {{/vertical-collection}}
  </div>
  `);

  const scrollable = this.$('.scrollable');
  const waitForScroll = new Ember.RSVP.Promise((resolve) => scrollable.scroll(resolve));

  return wait()
    .then(() => {
      // Jump to bottom.
      scrollable.scrollTop(scrollable.get(0).scrollHeight);
    })
    .then(waitForScroll)
    .then(wait)
    .then(() => {
      assert.equal(scrollable.find('div:last').html(), 'b 49', 'the last item in the list should be rendered');
    });
});

test('Sends the firstVisibleChanged action', function(assert) {
  const called = assert.async(2);
  let count = 0;

  this.set('items', Array(50).fill({ text: 'b' }));
  this.on('firstVisibleChanged', (item, index) => {
    if (count === 0) {
      assert.equal(index, 0, 'the first last visible changed should be item 0');
    } else {
      assert.equal(index, 10, 'after scroll the last visible change should be item 10');
    }
    count++;
    called();
  });

  this.render(hbs`
  <div style="height: 200px; width: 100px;" class="scrollable">
    {{#vertical-collection ${'items'}
      minHeight=20
      firstVisibleChanged="firstVisibleChanged"

      as |item|}}
      <div style="height:20px;">
        {{item.text}} {{i}}
      </div>
    {{/vertical-collection}}
  </div>
  `);

  wait().then(() => this.$('.scrollable').scrollTop(200));
});

test('Sends the lastVisibleChanged action', function(assert) {
  const called = assert.async(2);
  let count = 0;

  this.set('items', Array(50).fill({ text: 'b' }));
  this.on('lastVisibleChanged', (item, index) => {
    if (count === 0) {
      assert.equal(index, 10, 'the first last visible changed should be item 10');
    } else {
      assert.equal(index, 20, 'after scroll the last visible change should be item 20');
    }
    count++;
    called();
  });

  this.render(hbs`
  <div style="height: 200px; width: 100px;" class="scrollable">
    {{#vertical-collection ${'items'}
      minHeight=20
      lastVisibleChanged="lastVisibleChanged"

      as |item|}}
      <div style="height:20px;">
        {{item.text}} {{i}}
      </div>
    {{/vertical-collection}}
  </div>
  `);

  wait().then(() => this.$('.scrollable').scrollTop(200));
});

test('Sends the firstReached action', function(assert) {
  const called = assert.async(1);

  this.set('items', Array(50).fill({ text: 'b' }));
  this.on('firstReached', (item, index) => {
    assert.equal(index, 0, 'the first last visible changed should be item 0');
    called();
  });

  this.render(hbs`
  <div style="height: 200px; width: 100px;" class="scrollable">
    {{#vertical-collection ${'items'}
      minHeight=20
      firstReached="firstReached"

      as |item|}}
      <div style="height:20px;">
        {{item.text}} {{i}}
      </div>
    {{/vertical-collection}}
  </div>
  `);
});

test('Sends the lastReached action', function(assert) {
  const called = assert.async(1);

  this.set('items', Array(50).fill({ text: 'b' }));
  this.on('lastReached', (item, index) => {
    assert.equal(index, 49, 'the first last visible changed should be item 10');
    called();
  });

  this.render(hbs`
  <div style="height: 200px; width: 100px;" class="scrollable">
    {{#vertical-collection ${'items'}
      minHeight=20
      lastReached="lastReached"

      as |item|}}
      <div style="height:20px;">
        {{item.text}} {{i}}
      </div>
    {{/vertical-collection}}
  </div>
  `);

  wait().then(() => this.$('.scrollable').scrollTop(800));
});

test('Sends the firstReached after prepend', function(assert) {
  assert.expect(0);
  const called = assert.async(3);

  this.set('items', Ember.A(getNumbers(0, 10)));
  this.on('firstReached', ({ number }) => {
    this.get('items').unshiftObjects(getNumbers(number - 10, 10));
    called();
  });

  this.render(hbs`
  <div style="height: 200px; width: 100px;" class="scrollable">
    {{#vertical-collection ${'items'}
      minHeight=20
      firstReached="firstReached"

      as |item index|}}
      <div style="height:20px;">
        {{item.number}} {{index}}
      </div>
    {{/vertical-collection}}
  </div>
  `);
});

test('Sends the lastReached after append', function(assert) {
  assert.expect(0);
  const called = assert.async(3);

  this.set('items', Ember.A(getNumbers(0, 10)));
  this.on('lastReached', ({ number }) => {
    this.get('items').pushObjects(getNumbers(number, 10));
    called();
  });

  this.render(hbs`
  <div style="height: 200px; width: 100px;" class="scrollable">
    {{#vertical-collection ${'items'}
      minHeight=20
      lastReached="lastReached"

      as |item index|}}
      <div style="height:20px;">
        {{item.number}} {{index}}
      </div>
    {{/vertical-collection}}
  </div>
  `);
});

test('Collection measures correctly when it\'s scroll parent has scrolled', function(assert) {
  assert.expect(0);
  this.set('items', Ember.A(getNumbers(0, 100)));

  this.render(hbs`
  <div style="height: 200px; width: 200px;" class="scroll-parent scrollable">
    <div style="height: 400px; width: 100px;" class="scroll-child scrollable">
      {{#vertical-collection ${'items'}
        minHeight=20
        alwaysRemeasure=true

        as |item i|}}
        <div style="height:20px;">
          {{item.number}} {{i}}
        </div>
      {{/vertical-collection}}
    </div>
  </div>
  `);

  const scrollChild = this.$('.scroll-child');
  const scrollParent = this.$('.scroll-parent');

  return wait().then(() => {
    scrollParent.scrollTop(200);
    scrollChild.scrollTop(600);
    // An assertion will be thrown if the scroll parent affects the measurement
  });
});
