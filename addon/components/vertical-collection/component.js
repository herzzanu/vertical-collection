/* global Array, Math */
import Ember from 'ember';
import layout from './template';
import getTagDescendant from '../../utils/get-tag-descendant';
import scheduler from '../../-private/scheduler';
import estimateElementHeight from '../../utils/element/estimate-element-height';
import closestElement from '../../utils/element/closest';
import Token from '../../-private/scheduler/token';
import List from './data-view/list';
import RecycleContainer from './data-view/recycle-container';

const {
  A,
  get,
  set,
  computed,
  Component,
  String: { htmlSafe }
} = Ember;

function getArg(args, name) {
  return (args && args[name]) ? (args[name].value || args[name]) : undefined;
}

const VerticalCollection = Component.extend({
  layout,

  /*
   * If itemTagName is blank or null, the `vertical-collection` will [tag match](../addon/utils/get-tag-descendant.js)
   * with the `vertical-item`.
   */
  tagName: 'vertical-collection',
  itemTagName: null,
  itemClassNames: '',
  attributeBindings: ['boxStyle:style'],
  boxStyle: htmlSafe(''),

  key: '@identity',
  content: computed.deprecatingAlias('items'),

  // –––––––––––––– Required Settings

  defaultHeight: 75,

  // usable via {{#vertical-collection <items-array>}}
  items: null,

  // –––––––––––––– Optional Settings
  alwaysRemeasure: false,
  alwaysUseDefaultHeight: computed.not('alwaysRemeasure'),

  /*
   * A selector string that will select the element from
   * which to calculate the viewable height and needed offsets.
   *
   * This element will also have the `scroll` event handler added to it.
   *
   * Usually this element will be the component's immediate parent element,
   * if so, you can leave this null.
   *
   * Set this to "body" to scroll the entire web page.
   */
  containerSelector: null,


  // –––––––––––––– Performance Tuning
  /*
   * how much extra room to keep visible and invisible on
   * either side of the viewport.
   */
  bufferSize: 0.25,

  // –––––––––––––– Initial Scroll State
  /*
   *  If set, this will be used to set
   *  the scroll position at which the
   *  component initially renders.
   */
  scrollPosition: 0,

  /*
   * If set, upon initialization the scroll
   * position will be set such that the item
   * with the provided id is at the top left
   * on screen.
   *
   * If the item cannot be found, scrollTop
   * is set to 0.
   */
  idForFirstItem: null,

  /*
   * If set, if scrollPosition is empty
   * at initialization, the component will
   * render starting at the bottom.
   */
  renderFromLast: false,

  // –––––––––––––– @private

  _defaultHeight: computed('defaultHeight', function() {
    let defaultHeight = this.get('defaultHeight');

    if (typeof defaultHeight === 'number') {
      defaultHeight = `${defaultHeight}px`;
    }

    return defaultHeight;
  }),
  defaultItemPixelHeight: computed('defaultHeight', function() {
    return estimateElementHeight(this.element, this.get('defaultHeight'));
  }),

  _isFirstRender: true,
  _isInitializingFromLast: false,
  _firstVisibleIndex: 0,
  _initialRenderCount: 3,
  _isPrepending: false,

  token: null,
  _tracker: null,

  _proxied: null,
  _nextUpdate: null,
  _nextSync: null,
  _nextScrollSync: null,

  schedule(queueName, job) {
    return scheduler.schedule(queueName, job, this.token);
  },

  _findFirstToRender(visibleTop, scrollIsForward) {
    const { ordered } = this._tracker;
    const { _proxied } = this;

    let first = _proxied[0];
    let position = 0;
    let index = 0;

    if (first) {
      index = first.content.index;
      let bottom = first.content.geography.bottom;
      let isVisible = bottom > visibleTop;
      let isFirst = index === 0;

      if (scrollIsForward) {
        return isVisible ? { position, index } : { position: 1, index: index + 1 };
      }

      if (isFirst) {
        return { position, index };
      }

      let prev = ordered[index - 1];

      return prev.geography.bottom > visibleTop ?
        { position: -1, index: index - 1 } : { position, index };
    }

    return { position, index };
  },

  /*
   Binary search for finding the topmost visible view when restoring
   scroll position.

   This is not the first visible item on screen, but the first
   item that will render it's content.

   @method _findFirstRenderedComponent
   @param {Number} invisibleTop The top/left of the viewport to search against
   @returns {Number} the index into childViews of the first view to render
   **/
  /*
  _findFirstRenderedComponent(visibleTop) {
    const childComponents = this.get('children');
    let maxIndex = childComponents.length - 1;
    let minIndex = 0;
    let midIndex;

    if (maxIndex < 0) {
      return 0;
    }

    while (maxIndex > minIndex) {
      midIndex = Math.floor((minIndex + maxIndex) / 2);

      // in case of not full-window scrolling
      const component = childComponents[midIndex];
      const componentBottom = component.satellite.geography.bottom;

      if (componentBottom > visibleTop) {
        maxIndex = midIndex - 1;
      } else {
        minIndex = midIndex + 1;
      }
    }

    return minIndex;
  },
  */

  didReceiveAttrs(args) {
    // const oldArray = getArg(args.oldAttrs, 'items');
    const newArray = getArg(args.newAttrs, 'items');

    this._tracker.updateList(newArray);
    this.updateActiveItems(this._tracker.slice());
    this._scheduleUpdate();
    /*
        if (this._tracker.lastUpdateWasPrepend) {
          this._nextUpdate = this.schedule('layout', () => {
            this.radar.silentNight();
            this._updateChildStates();
            this._isPrepending = false;
            this._nextUpdate = null;
          });
        } else {
          this._scheduleSync();
        }

    if (oldArray && newArray && this._changeIsPrepend(oldArray, newArray)) {
      this._isPrepending = true;
      scheduler.forget(this._nextUpdate);

      this._nextUpdate = this.schedule('layout', () => {
        this.radar.silentNight();
        this._updateChildStates();
        this._isPrepending = false;
        this._nextUpdate = null;
      });

    } else {
      if (newArray && (!oldArray || get(oldArray, 'length') <= get(newArray, 'length'))) {
        this._scheduleUpdate();
      }

      this._scheduleSync();
    }
    */
  },

  _scheduleUpdate() {
    if (this._isPrepending) {
      return;
    }
    if (this._nextUpdate === null) {
      this._nextUpdate = this.schedule('layout', () => {
        this._updateChildStates();
        this._nextUpdate = null;
      });
    }
  },

  _scheduleSync() {
    if (this._nextSync === null) {
      this._nextSync = this.schedule('layout', () => {
        this._tracker.radar.updateSkyline();
        this._nextSync = null;
      });
    }
  },

  _scheduleScrollSync() {
    if (this._isInitializingFromLast) {
      if (this._nextScrollSync === null) {
        this._nextScrollSync = this.schedule('measure', () => {
          const last = this.element.lastElementChild;

          this._isInitializingFromLast = false;
          if (last) {
            last.scrollIntoView(false);
          }

          this._nextScrollSync = null;
        });
      }
    }
  },

  updateActiveItems: function(inbound) {
    const outbound = this._proxied;

    if (!inbound || !inbound.length) {
      outbound.length = 0;
      return outbound;
    }

    for (let i = 0; i < inbound.length; i++) {
      outbound[i] = outbound[i] || new RecycleContainer();
      set(outbound[i], 'content', inbound[i]);
      outbound[i].position = i;
    }
    // this.notifyPropertyChange('length');

    this.set('activeItems', outbound);
    this.notifyPropertyChange('activeItems');
  },

  /*
   *
   * The big question is can we render from the bottom
   * without the bottom most item being taken off screen?
   *
   * Triggers on scroll.
   *
   * @private
   */
  _updateChildStates() {
    if (this._isFirstRender) {;

      this._initialRenderCount -= 1;
      this._tracker._activeCount += 1;
      this.updateActiveItems(this._tracker.slice());

      let { heightAbove, heightBelow } = this._tracker;

      this.set('boxStyle', htmlSafe(`padding-top: ${heightAbove}px; padding-bottom: ${heightBelow}px;`));

      this.schedule('affect', () => {
        window.chunk = window.chunk ? ++window.chunk : 0
        console.log('appending chunk #' + window.chunk);
        this._tracker.radar.rebuild();

        if (this._initialRenderCount === 0) {
          console.log('bailing!');
          this._isFirstRender = false;
          return;
        }

        this._scheduleUpdate();
      });
      return;
    }

    const { edges, _scrollIsForward } = this._tracker.radar;
    const { ordered } = this._tracker;
    const { _proxied } = this;
    const currentViewportBound = this._tracker.radar.skyline.top;
    let currentUpperBound = edges.bufferedTop;

    if (currentUpperBound < currentViewportBound) {
      currentUpperBound = currentViewportBound;
    }

    const { position, index } = this._findFirstToRender(currentUpperBound, _scrollIsForward);
    let topItemIndex = index;
    const maxIndex = ordered.length - 1;
    let bottomItemIndex = topItemIndex;
    let topVisibleSpotted = false;

    // console.log('edges', edges);

    while (bottomItemIndex <= maxIndex) {
      const ref = ordered[bottomItemIndex];
      const itemTop = ref.geography.top;
      const itemBottom = ref.geography.bottom;
      // console.log('examining', ref);

      // end the loop if we've reached the end of components we care about
      if (itemTop > edges.bufferedBottom) {
        break;
      }

      // above the upper reveal boundary
      if (itemBottom < edges.bufferedTop) {
        bottomItemIndex++;
        continue;
      }

      // above the upper screen boundary
      if (itemBottom < edges.visibleTop) {
        /*
        if (bottomItemIndex === 0) {
          this.sendActionOnce('firstReached', {
            item: component,
            index: bottomItemIndex
          });
        }
        */
        bottomItemIndex++;
        continue;
      }

      // above the lower screen boundary
      if (itemTop < edges.visibleBottom) {
        /*
        if (bottomItemIndex === 0) {
          this.sendActionOnce('firstReached', {
            item: component,
            index: bottomItemIndex
          });
        }
        if (bottomItemIndex === lastIndex) {
          this.sendActionOnce('lastReached', {
            item: component,
            index: bottomItemIndex
          });
        }
        */

        if (!topVisibleSpotted) {
          topVisibleSpotted = true;

          /*
          this.set('_firstVisibleIndex', bottomItemIndex);
          this.sendActionOnce('firstVisibleChanged', {
            item: component,
            index: bottomItemIndex
          });
          */
        }

        bottomItemIndex++;
        continue;
      }

      // above the lower reveal boundary (componentTop < edges.bufferedBottom)
        /*
        if (bottomItemIndex === lastIndex) {
          this.sendActionOnce('lastReached', {
            item: component,
            index: bottomItemIndex
          });
        }
        */
      bottomItemIndex++;
    }

    /*
    this.sendActionOnce('lastVisibleChanged', {
      item: ordered[bottomItemIndex - 1],
      index: bottomItemIndex - 1
    });
    */

    // debugger;
    // this._scheduleScrollSync();

    /*
    if (this._isFirstRender) {
      this._isFirstRender = false;
      this.sendActionOnce('didMountCollection', {
        firstVisible: { item: ordered[topItemIndex], index: topItemIndex },
        lastVisible: { item: ordered[bottomItemIndex - 1], index: bottomItemIndex - 1 }
      });
    }
    */

    let len = bottomItemIndex - topItemIndex;
    let curProxyLen = _proxied.length;
    let lenDiff = len - curProxyLen;
    let altered;

    if (lenDiff < 0) {
      let absDiff = -1 * lenDiff;
      let n = len + absDiff;

      if (_scrollIsForward) {
        // console.log('removing ' + absDiff + ' active items from use from the top');
        // altered = _proxied.splice(0, absDiff);
        if (topItemIndex - n < 0) {
          topItemIndex = 0;
          bottomItemIndex = n;
        } else {
          topItemIndex -= absDiff;
        }
      } else {
        // console.log('removing ' + absDiff + ' active items from use from the bottom');
        // altered = _proxied.splice(len, absDiff);
        if (bottomItemIndex + n > maxIndex) {
          topItemIndex = maxIndex - n;
          bottomItemIndex = maxIndex;
        } else {
          bottomItemIndex += absDiff;
        }
      }
      lenDiff = 0;
    } else if (lenDiff > 0) {
      console.log('adding ' + lenDiff + ' active items');
      altered = new Array(lenDiff);

      for (let i = 0; i < lenDiff; i++) {
        altered[i] = new RecycleContainer(null, curProxyLen + i);
      }
      if (_scrollIsForward) {
        console.log('adding to bottom');
        _proxied.splice(_proxied.length, 0, ...altered);
      } else {
        console.log('adding to top');
        _proxied.splice(0, 0, ...altered);
      }
    }

    if (position < 0) {
      console.log('shifted last to front');
      _proxied.unshift(_proxied.pop());
    } else if (position > 0) {
      console.log('shifted front to last');
      _proxied.push(_proxied.shift());
    }

    let _slice = this._tracker.slice(topItemIndex, bottomItemIndex);

    for (let i = 0; i < len; i++) {
      if (_proxied[i].content !== _slice[i]) {
        set(_proxied[i], 'content', _slice[i]);
      }
    }

    // _proxied.notifyPropertyChanges();
    this.set('activeItems', _proxied);
    this.notifyPropertyChange('activeItems');
    console.log('active items', _proxied);

    let { heightAbove, heightBelow } = this._tracker;

    this.set('boxStyle', htmlSafe(`padding-top: ${heightAbove}px; padding-bottom: ${heightBelow}px;`));
  },

  /*
  _oldUpdateChildStates() {  // eslint: complexity
    const edges = this._edges;
    const childComponents = this.get('children');

    if (!get(childComponents, 'length')) {
      return;
    }


    if (this._isFirstRender) {
      if (this.get('renderAllInitially')) {
        childComponents.forEach((i) => {
          i.show();
        });

        this._scheduleScrollSync();

        this._isFirstRender = false;
        return;
      }
    }
      ...

    this._scheduleScrollSync();

    if (this._isFirstRender) {
      this._isFirstRender = false;
      this.sendActionOnce('didMountCollection', {
        firstVisible: { item: childComponents[topComponentIndex], index: topComponentIndex },
        lastVisible: { item: childComponents[bottomComponentIndex - 1], index: bottomComponentIndex - 1 }
      });
    }
  },
  */

  // –––––––––––––– Setup/Teardown
  didInsertElement() {
    this.setupRadar();
    // this._initializeScrollState();
    // this._scheduleUpdate();
    console.timeEnd('vertical-collection-init');
  },

  setupRadar() {
    const containerSelector = this.get('containerSelector');
    let container;

    if (containerSelector === 'body') {
      container = window;
    } else {
      container = containerSelector ? closestElement(containerSelector) : this.element.parentNode;
    }

    this._tracker.setupRadar({
      telescope: container,
      sky: this.element,
      minimumMovement: Math.floor(this.get('defaultHeight') / 2),
      bufferSize: this.get('bufferSize')
    });

    this._tracker.updateVisibleContent = () => { this._updateChildStates(); };
  },

  /*
  _initializeScrollState() {
    const idForFirstItem = this.get('idForFirstItem');

    if (this.scrollPosition) {
      this.radar.telescope.scrollTop = this.scrollPosition;
    } else if (this.get('renderFromLast')) {
      const last = this.element.lastElementChild;

      this.set('__isInitializingFromLast', true);
      if (last) {
        last.scrollIntoView(false);
      }
    } else if (idForFirstItem) {
      const items = this.get('items');
      let firstVisibleIndex;

      for (let i = 0; i < get(items, 'length'); i++) {
        if (idForFirstItem === this.keyForItem(valueForIndex(items, i), i)) {
          firstVisibleIndex = i;
        }
      }
      this.radar.telescope.scrollTop = (firstVisibleIndex || 0) * this.get('_defaultHeight');
    }
  },
*/

  willDestroyElement() {
    this.token.cancelled = true;
    this._tracker.destroy();
    this._tracker = null;
  },

  init() {
    console.time('vertical-collection-init');
    this._super();

    if (!this.get('itemTagName')) {
      const collectionTagName = (this.get('tagName') || '').toLowerCase();
      this.set('itemTagName', getTagDescendant(collectionTagName));
    }

    this._tracker = new List(null, this.get('key'), this.get('defaultHeight'));
    this._proxied = new A();
    this.token = new Token();
    window.collection = this;
  }
});

VerticalCollection.reopenClass({
  positionalParams: ['items']
});

export default VerticalCollection;
