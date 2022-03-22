
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function append_styles(target, style_sheet_id, styles) {
        const append_styles_to = get_root_for_style(target);
        if (!append_styles_to.getElementById(style_sheet_id)) {
            const style = element('style');
            style.id = style_sheet_id;
            style.textContent = styles;
            append_stylesheet(append_styles_to, style);
        }
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.46.4' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src-svelte\components\Navbar.svelte generated by Svelte v3.46.4 */

    const file$7 = "src-svelte\\components\\Navbar.svelte";

    function add_css$7(target) {
    	append_styles(target, "svelte-lnu5x0", ".container.svelte-lnu5x0.svelte-lnu5x0{padding-bottom:59px;display:flex;flex:1 1 auto;flex-direction:row;width:100%;height:51px;background-color:var(--main-background)}.container.svelte-lnu5x0 span.svelte-lnu5x0{font-weight:600}.container.svelte-lnu5x0 div.svelte-lnu5x0{display:flex;color:#b9b9b9;align-items:center;justify-content:center;width:81px;height:51px;transition:all ease-out .2s}.container.svelte-lnu5x0 div.svelte-lnu5x0:hover{cursor:pointer}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTmF2YmFyLnN2ZWx0ZSIsInNvdXJjZXMiOlsiTmF2YmFyLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxyXG4gICAgZXhwb3J0IGxldCBwZ247XHJcblxyXG4gICAgbGV0IGNsY29sb3IgPSAnI2I5YjliOSdcclxuICAgIGxldCBzdGNvbG9yID0gJyNiOWI5YjknXHJcblxyXG4gICAgJDoge1xyXG4gICAgICBpZiAocGduID09IDApIHtcclxuICAgICAgICBjbGNvbG9yID0gJ3doaXRlJztcclxuICAgICAgICBzdGNvbG9yID0gJyNiOWI5YjknO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNsY29sb3IgPSAnI2I5YjliOSc7XHJcbiAgICAgICAgc3Rjb2xvciA9ICd3aGl0ZSdcclxuICAgICAgfVxyXG4gICAgfVxyXG48L3NjcmlwdD5cclxuXHJcbjxkaXYgY2xhc3M9XCJjb250YWluZXJcIiBkYXRhLXRhdXJpLWRyYWctcmVnaW9uPlxyXG4gIDxkaXYgb246Y2xpY2s9eygpID0+IHtwZ24gPSAwfX0gc3R5bGU9XCJjb2xvcjoge2NsY29sb3J9XCI+XHJcbiAgICA8c3Bhbj5cclxuICAgICAgICBDaGF0bGlzdFxyXG4gICAgPC9zcGFuPlxyXG4gIDwvZGl2PlxyXG4gIDxkaXYgb246Y2xpY2s9eygpID0+IHtwZ24gPSAxfX0gc3R5bGU9XCJjb2xvcjoge3N0Y29sb3J9XCI+XHJcbiAgICA8c3Bhbj5cclxuICAgICAgICBTZXR0aW5nc1xyXG4gICAgPC9zcGFuPlxyXG4gIDwvZGl2PlxyXG48L2Rpdj5cclxuXHJcbjxzdHlsZSBsYW5nPVwic2Nzc1wiPi5jb250YWluZXIge1xuICBwYWRkaW5nLWJvdHRvbTogNTlweDtcbiAgZGlzcGxheTogZmxleDtcbiAgZmxleDogMSAxIGF1dG87XG4gIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gIHdpZHRoOiAxMDAlO1xuICBoZWlnaHQ6IDUxcHg7XG4gIGJhY2tncm91bmQtY29sb3I6IHZhcigtLW1haW4tYmFja2dyb3VuZCk7IH1cbiAgLmNvbnRhaW5lciBzcGFuIHtcbiAgICBmb250LXdlaWdodDogNjAwOyB9XG4gIC5jb250YWluZXIgZGl2IHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGNvbG9yOiAjYjliOWI5O1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgd2lkdGg6IDgxcHg7XG4gICAgaGVpZ2h0OiA1MXB4O1xuICAgIHRyYW5zaXRpb246IGFsbCBlYXNlLW91dCAuMnM7IH1cbiAgLmNvbnRhaW5lciBkaXY6aG92ZXIge1xuICAgIGN1cnNvcjogcG9pbnRlcjsgfVxuPC9zdHlsZT5cclxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQThCbUIsVUFBVSw0QkFBQyxDQUFDLEFBQzdCLGNBQWMsQ0FBRSxJQUFJLENBQ3BCLE9BQU8sQ0FBRSxJQUFJLENBQ2IsSUFBSSxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUNkLGNBQWMsQ0FBRSxHQUFHLENBQ25CLEtBQUssQ0FBRSxJQUFJLENBQ1gsTUFBTSxDQUFFLElBQUksQ0FDWixnQkFBZ0IsQ0FBRSxJQUFJLGlCQUFpQixDQUFDLEFBQUUsQ0FBQyxBQUMzQyx3QkFBVSxDQUFDLElBQUksY0FBQyxDQUFDLEFBQ2YsV0FBVyxDQUFFLEdBQUcsQUFBRSxDQUFDLEFBQ3JCLHdCQUFVLENBQUMsR0FBRyxjQUFDLENBQUMsQUFDZCxPQUFPLENBQUUsSUFBSSxDQUNiLEtBQUssQ0FBRSxPQUFPLENBQ2QsV0FBVyxDQUFFLE1BQU0sQ0FDbkIsZUFBZSxDQUFFLE1BQU0sQ0FDdkIsS0FBSyxDQUFFLElBQUksQ0FDWCxNQUFNLENBQUUsSUFBSSxDQUNaLFVBQVUsQ0FBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQUFBRSxDQUFDLEFBQ2pDLHdCQUFVLENBQUMsaUJBQUcsTUFBTSxBQUFDLENBQUMsQUFDcEIsTUFBTSxDQUFFLE9BQU8sQUFBRSxDQUFDIn0= */");
    }

    function create_fragment$7(ctx) {
    	let div2;
    	let div0;
    	let span0;
    	let t1;
    	let div1;
    	let span1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			span0.textContent = "Chatlist";
    			t1 = space();
    			div1 = element("div");
    			span1 = element("span");
    			span1.textContent = "Settings";
    			attr_dev(span0, "class", "svelte-lnu5x0");
    			add_location(span0, file$7, 19, 4, 399);
    			set_style(div0, "color", /*clcolor*/ ctx[1]);
    			attr_dev(div0, "class", "svelte-lnu5x0");
    			add_location(div0, file$7, 18, 2, 336);
    			attr_dev(span1, "class", "svelte-lnu5x0");
    			add_location(span1, file$7, 24, 4, 513);
    			set_style(div1, "color", /*stcolor*/ ctx[2]);
    			attr_dev(div1, "class", "svelte-lnu5x0");
    			add_location(div1, file$7, 23, 2, 450);
    			attr_dev(div2, "class", "container svelte-lnu5x0");
    			attr_dev(div2, "data-tauri-drag-region", "");
    			add_location(div2, file$7, 17, 0, 286);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, span0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, span1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div0, "click", /*click_handler*/ ctx[3], false, false, false),
    					listen_dev(div1, "click", /*click_handler_1*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*clcolor*/ 2) {
    				set_style(div0, "color", /*clcolor*/ ctx[1]);
    			}

    			if (dirty & /*stcolor*/ 4) {
    				set_style(div1, "color", /*stcolor*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Navbar', slots, []);
    	let { pgn } = $$props;
    	let clcolor = '#b9b9b9';
    	let stcolor = '#b9b9b9';
    	const writable_props = ['pgn'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Navbar> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => {
    		$$invalidate(0, pgn = 0);
    	};

    	const click_handler_1 = () => {
    		$$invalidate(0, pgn = 1);
    	};

    	$$self.$$set = $$props => {
    		if ('pgn' in $$props) $$invalidate(0, pgn = $$props.pgn);
    	};

    	$$self.$capture_state = () => ({ pgn, clcolor, stcolor });

    	$$self.$inject_state = $$props => {
    		if ('pgn' in $$props) $$invalidate(0, pgn = $$props.pgn);
    		if ('clcolor' in $$props) $$invalidate(1, clcolor = $$props.clcolor);
    		if ('stcolor' in $$props) $$invalidate(2, stcolor = $$props.stcolor);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*pgn*/ 1) {
    			{
    				if (pgn == 0) {
    					$$invalidate(1, clcolor = 'white');
    					$$invalidate(2, stcolor = '#b9b9b9');
    				} else {
    					$$invalidate(1, clcolor = '#b9b9b9');
    					$$invalidate(2, stcolor = 'white');
    				}
    			}
    		}
    	};

    	return [pgn, clcolor, stcolor, click_handler, click_handler_1];
    }

    class Navbar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { pgn: 0 }, add_css$7);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Navbar",
    			options,
    			id: create_fragment$7.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*pgn*/ ctx[0] === undefined && !('pgn' in props)) {
    			console.warn("<Navbar> was created without expected prop 'pgn'");
    		}
    	}

    	get pgn() {
    		throw new Error("<Navbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pgn(value) {
    		throw new Error("<Navbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /// Functions used to call core app functions (tauri invokes)

    /**
     * 
     */
    function openProxyWindow() {
        let win = window.__TAURI__.window.WebviewWindow.getByLabel('proxies');
        win.show();
    }
    /**
     * 
     */
    function openTokenWindow() {
        let win = window.__TAURI__.window.WebviewWindow.getByLabel('tokens');
        win.show();
    }

    /**
     * @description joins all tokens to the server 
     */
    function joinServer(code) {
        window.__TAURI__.invoke('join_server', {link: code});
    }

    /**
     * @description updates the raid state to stop or continue raiding
     */
    function updateRaidState(state) {
        window.__TAURI__.invoke('update_raid_state', {state: state});
    }

    var core = /*#__PURE__*/Object.freeze({
        __proto__: null,
        openProxyWindow: openProxyWindow,
        openTokenWindow: openTokenWindow,
        joinServer: joinServer,
        updateRaidState: updateRaidState
    });

    /* src-svelte\components\Switch.svelte generated by Svelte v3.46.4 */

    const file$6 = "src-svelte\\components\\Switch.svelte";

    function add_css$6(target) {
    	append_styles(target, "svelte-1f2rgho", ".switch.svelte-1f2rgho.svelte-1f2rgho{position:relative;display:inline-block;width:149px;height:49px}.switch.svelte-1f2rgho input.svelte-1f2rgho{opacity:0;width:0;height:0}.slider.svelte-1f2rgho.svelte-1f2rgho{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:#ccc;-webkit-transition:0.4s;transition:0.4s;border-radius:34px}.slider.svelte-1f2rgho.svelte-1f2rgho:before{position:absolute;content:\"\";height:41px;width:41px;left:4px;bottom:4px;background-color:white;-webkit-transition:0.4s;transition:0.4s;border-radius:50%}input.svelte-1f2rgho:checked+.slider.svelte-1f2rgho{background:var(--main-grad)}input.svelte-1f2rgho:checked+.slider.svelte-1f2rgho:before{-webkit-transform:translateX(98px);-ms-transform:translateX(98px);transform:translateX(98px)}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3dpdGNoLnN2ZWx0ZSIsInNvdXJjZXMiOlsiU3dpdGNoLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxyXG4gICAgZXhwb3J0IGxldCBjaGVja2VkID0gZmFsc2U7XHJcbjwvc2NyaXB0PlxyXG4gIFxyXG4gIDxzdHlsZT5cclxuICAgIC5zd2l0Y2gge1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcclxuICAgICAgd2lkdGg6IDE0OXB4O1xyXG4gICAgICBoZWlnaHQ6IDQ5cHg7XHJcbiAgICB9XHJcbiAgXHJcbiAgICAuc3dpdGNoIGlucHV0IHtcclxuICAgICAgb3BhY2l0eTogMDtcclxuICAgICAgd2lkdGg6IDA7XHJcbiAgICAgIGhlaWdodDogMDtcclxuICAgIH1cclxuICBcclxuICAgIC5zbGlkZXIge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgdG9wOiAwO1xyXG4gICAgICBsZWZ0OiAwO1xyXG4gICAgICByaWdodDogMDtcclxuICAgICAgYm90dG9tOiAwO1xyXG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjY2NjO1xyXG4gICAgICAtd2Via2l0LXRyYW5zaXRpb246IDAuNHM7XHJcbiAgICAgIHRyYW5zaXRpb246IDAuNHM7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDM0cHg7XHJcbiAgICB9XHJcbiAgXHJcbiAgICAuc2xpZGVyOmJlZm9yZSB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgY29udGVudDogXCJcIjtcclxuICAgICAgaGVpZ2h0OiA0MXB4O1xyXG4gICAgICB3aWR0aDogNDFweDtcclxuICAgICAgbGVmdDogNHB4O1xyXG4gICAgICBib3R0b206IDRweDtcclxuICAgICAgYmFja2dyb3VuZC1jb2xvcjogd2hpdGU7XHJcbiAgICAgIC13ZWJraXQtdHJhbnNpdGlvbjogMC40cztcclxuICAgICAgdHJhbnNpdGlvbjogMC40cztcclxuICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xyXG4gICAgfVxyXG4gIFxyXG4gICAgaW5wdXQ6Y2hlY2tlZCArIC5zbGlkZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1tYWluLWdyYWQpO1xyXG4gICAgfVxyXG4gIFxyXG4gIFxyXG4gICAgaW5wdXQ6Y2hlY2tlZCArIC5zbGlkZXI6YmVmb3JlIHtcclxuICAgICAgLXdlYmtpdC10cmFuc2Zvcm06IHRyYW5zbGF0ZVgoOThweCk7XHJcbiAgICAgIC1tcy10cmFuc2Zvcm06IHRyYW5zbGF0ZVgoOThweCk7XHJcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg5OHB4KTtcclxuICAgIH1cclxuICA8L3N0eWxlPlxyXG4gIFxyXG4gIDxsYWJlbCBjbGFzcz1cInN3aXRjaFwiPlxyXG4gICAgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGJpbmQ6Y2hlY2tlZCAvPlxyXG4gICAgPHNwYW4gY2xhc3M9XCJzbGlkZXJcIiAvPlxyXG4gIDwvbGFiZWw+Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUtJLE9BQU8sOEJBQUMsQ0FBQyxBQUNQLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLE9BQU8sQ0FBRSxZQUFZLENBQ3JCLEtBQUssQ0FBRSxLQUFLLENBQ1osTUFBTSxDQUFFLElBQUksQUFDZCxDQUFDLEFBRUQsc0JBQU8sQ0FBQyxLQUFLLGVBQUMsQ0FBQyxBQUNiLE9BQU8sQ0FBRSxDQUFDLENBQ1YsS0FBSyxDQUFFLENBQUMsQ0FDUixNQUFNLENBQUUsQ0FBQyxBQUNYLENBQUMsQUFFRCxPQUFPLDhCQUFDLENBQUMsQUFDUCxRQUFRLENBQUUsUUFBUSxDQUNsQixNQUFNLENBQUUsT0FBTyxDQUNmLEdBQUcsQ0FBRSxDQUFDLENBQ04sSUFBSSxDQUFFLENBQUMsQ0FDUCxLQUFLLENBQUUsQ0FBQyxDQUNSLE1BQU0sQ0FBRSxDQUFDLENBQ1QsZ0JBQWdCLENBQUUsSUFBSSxDQUN0QixrQkFBa0IsQ0FBRSxJQUFJLENBQ3hCLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLGFBQWEsQ0FBRSxJQUFJLEFBQ3JCLENBQUMsQUFFRCxxQ0FBTyxPQUFPLEFBQUMsQ0FBQyxBQUNkLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLE9BQU8sQ0FBRSxFQUFFLENBQ1gsTUFBTSxDQUFFLElBQUksQ0FDWixLQUFLLENBQUUsSUFBSSxDQUNYLElBQUksQ0FBRSxHQUFHLENBQ1QsTUFBTSxDQUFFLEdBQUcsQ0FDWCxnQkFBZ0IsQ0FBRSxLQUFLLENBQ3ZCLGtCQUFrQixDQUFFLElBQUksQ0FDeEIsVUFBVSxDQUFFLElBQUksQ0FDaEIsYUFBYSxDQUFFLEdBQUcsQUFDcEIsQ0FBQyxBQUVELG9CQUFLLFFBQVEsQ0FBRyxPQUFPLGVBQUMsQ0FBQyxBQUN2QixVQUFVLENBQUUsSUFBSSxXQUFXLENBQUMsQUFDOUIsQ0FBQyxBQUdELG9CQUFLLFFBQVEsQ0FBRyxzQkFBTyxPQUFPLEFBQUMsQ0FBQyxBQUM5QixpQkFBaUIsQ0FBRSxXQUFXLElBQUksQ0FBQyxDQUNuQyxhQUFhLENBQUUsV0FBVyxJQUFJLENBQUMsQ0FDL0IsU0FBUyxDQUFFLFdBQVcsSUFBSSxDQUFDLEFBQzdCLENBQUMifQ== */");
    }

    function create_fragment$6(ctx) {
    	let label;
    	let input;
    	let t;
    	let span;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			label = element("label");
    			input = element("input");
    			t = space();
    			span = element("span");
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "class", "svelte-1f2rgho");
    			add_location(input, file$6, 57, 4, 1110);
    			attr_dev(span, "class", "slider svelte-1f2rgho");
    			add_location(span, file$6, 58, 4, 1154);
    			attr_dev(label, "class", "switch svelte-1f2rgho");
    			add_location(label, file$6, 56, 2, 1082);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, input);
    			input.checked = /*checked*/ ctx[0];
    			append_dev(label, t);
    			append_dev(label, span);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", /*input_change_handler*/ ctx[1]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*checked*/ 1) {
    				input.checked = /*checked*/ ctx[0];
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Switch', slots, []);
    	let { checked = false } = $$props;
    	const writable_props = ['checked'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Switch> was created with unknown prop '${key}'`);
    	});

    	function input_change_handler() {
    		checked = this.checked;
    		$$invalidate(0, checked);
    	}

    	$$self.$$set = $$props => {
    		if ('checked' in $$props) $$invalidate(0, checked = $$props.checked);
    	};

    	$$self.$capture_state = () => ({ checked });

    	$$self.$inject_state = $$props => {
    		if ('checked' in $$props) $$invalidate(0, checked = $$props.checked);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [checked, input_change_handler];
    }

    class Switch extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { checked: 0 }, add_css$6);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Switch",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get checked() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set checked(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src-svelte\pages\Chatlist.svelte generated by Svelte v3.46.4 */
    const file$5 = "src-svelte\\pages\\Chatlist.svelte";

    function add_css$5(target) {
    	append_styles(target, "svelte-1ymzol6", ".content.svelte-1ymzol6.svelte-1ymzol6{width:98%;height:750px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1.3fr 0.7fr;gap:0px 0px;grid-template-areas:\"tl chatlog\"\r \"logs chatlog\"\r \"start message\"}.inlineserver.svelte-1ymzol6.svelte-1ymzol6{display:inline-flex;gap:2em}.serverlink.svelte-1ymzol6.svelte-1ymzol6{width:210px;height:49px;justify-content:center;display:flex;align-items:center}.serverlink.svelte-1ymzol6 textarea.svelte-1ymzol6{resize:none;border:none;outline:none;color:var(--main-color);overflow:hidden;font-size:26px;align-content:center;text-decoration:none;background-color:var(--light-background);width:210px;height:30px}.message.svelte-1ymzol6.svelte-1ymzol6{grid-area:message;height:100%;width:100%;display:flex;align-items:center}.message.svelte-1ymzol6 textarea.svelte-1ymzol6{resize:none;border:none;font-size:20px;outline:none;color:var(--main-color);overflow:hidden;align-content:center;text-decoration:none;background-color:var(--light-background);width:100%;height:100px}.blgrid.svelte-1ymzol6.svelte-1ymzol6{align-self:center;width:calc(388px - 1em);gap:3em;font-size:18px;font-weight:600;padding-left:1em;height:104px;background-color:var(--light-background);display:inline-flex;align-items:center;grid-area:start}.logs.svelte-1ymzol6.svelte-1ymzol6{width:388px;height:327px;background-color:rgba(255, 255, 255, 0.14902);grid-area:logs}.logs.svelte-1ymzol6 .head.svelte-1ymzol6{width:100%;padding:8px}.chatlog.svelte-1ymzol6.svelte-1ymzol6{width:435px;height:100%;grid-area:chatlog;background-color:rgba(255, 255, 255, 0.14902)}.chatlog.svelte-1ymzol6 .head.svelte-1ymzol6{width:100%;padding:8px}.tlgrid.svelte-1ymzol6.svelte-1ymzol6{grid-area:tl;height:250px;width:50%;flex-wrap:wrap;display:flex;flex-direction:column;row-gap:2em;column-gap:1em}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2hhdGxpc3Quc3ZlbHRlIiwic291cmNlcyI6WyJDaGF0bGlzdC5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cclxuICBpbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uL2Z1bmN0aW9ucy5qcydcclxuICBpbXBvcnQgU3d0aWNoIGZyb20gXCIuLi9jb21wb25lbnRzL1N3aXRjaC5zdmVsdGVcIjtcclxuXHJcbiAgbGV0IHNlcnZlcmxpbms7XHJcbiAgbGV0IG1lc3NhZ2U7XHJcblxyXG4gIGxldCBzdG9wc3RhcnQgPSBmYWxzZTtcclxuXHJcbjwvc2NyaXB0PlxyXG5cclxuPGRpdiBjbGFzcz1cImNvbnRlbnRcIj5cclxuICA8ZGl2IGNsYXNzPVwidGxncmlkXCI+XHJcbiAgICA8ZGl2IGNsYXNzPVwiYnRuIGdyYWRcIiBvbjpjbGljaz17Y29yZS5vcGVuUHJveHlXaW5kb3d9PlBST1hJRVM8L2Rpdj5cclxuICAgIDxkaXYgY2xhc3M9XCJidG4gZ3JhZFwiIG9uOmNsaWNrPXtjb3JlLm9wZW5Ub2tlbldpbmRvd30+VE9LRU5TPC9kaXY+XHJcbiAgICA8ZGl2IGNsYXNzPVwiaW5saW5lc2VydmVyXCI+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJidG4gZ3JhZFwiIG9uOmNsaWNrPXtjb3JlLmpvaW5TZXJ2ZXIoKX0+Sk9JTiBTRVJWRVI8L2Rpdj5cclxuICAgICAgPGRpdiBjbGFzcz1cInNlcnZlcmxpbmtcIj5cclxuICAgICAgICA8dGV4dGFyZWEgYmluZDp2YWx1ZT17c2VydmVybGlua31cclxuICAgICAgICAgIHBsYWNlaG9sZGVyPVwiU2VydmVyIGxpbmtcIlxyXG4gICAgICAgICAgbmFtZT1cInNlcnZlcmxpbmtcIlxyXG4gICAgICAgICAgaWQ9XCJzbFwiXHJcbiAgICAgICAgICBjb2xzPVwiMzBcIlxyXG4gICAgICAgICAgcm93cz1cIjEwXCJcclxuICAgICAgICAvPlxyXG4gICAgICA8L2Rpdj5cclxuICAgIDwvZGl2PlxyXG4gIDwvZGl2PlxyXG4gIDxkaXYgY2xhc3M9XCJsb2dzXCI+PGRpdiBjbGFzcz1cImhlYWRcIj5Mb2dzPC9kaXY+PC9kaXY+XHJcbiAgPGRpdiBjbGFzcz1cImJsZ3JpZFwiPlxyXG4gICAgPGRpdj5TdG9wIFN0YXJ0IENoYXRib3Q8L2Rpdj5cclxuICAgIDxTd3RpY2ggYmluZDpjaGVja2VkPXtzdG9wc3RhcnR9IC8+XHJcbiAgPC9kaXY+XHJcbiAgPGRpdiBjbGFzcz1cImNoYXRsb2dcIj48ZGl2IGNsYXNzPVwiaGVhZFwiPkNoYXRsb2c8L2Rpdj48L2Rpdj5cclxuICA8ZGl2IGNsYXNzPVwibWVzc2FnZVwiPlxyXG4gICAgPHRleHRhcmVhXHJcbiAgICBiaW5kOnZhbHVlPXttZXNzYWdlfVxyXG4gICAgICBwbGFjZWhvbGRlcj1cIkVudGVyIHRleHQgbWVzc2FnZVwiXHJcbiAgICAgIG5hbWU9XCJtZXNzYWdlXCJcclxuICAgICAgaWQ9XCJtXCJcclxuICAgICAgY29scz1cIjMwXCJcclxuICAgICAgcm93cz1cIjEwXCJcclxuICAgIC8+XHJcbiAgPC9kaXY+XHJcbjwvZGl2PlxyXG5cclxuPHN0eWxlIGxhbmc9XCJzY3NzXCI+LmNvbnRlbnQge1xuICB3aWR0aDogOTglO1xuICBoZWlnaHQ6IDc1MHB4O1xuICBkaXNwbGF5OiBncmlkO1xuICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmciAxZnI7XG4gIGdyaWQtdGVtcGxhdGUtcm93czogMWZyIDEuM2ZyIDAuN2ZyO1xuICBnYXA6IDBweCAwcHg7XG4gIGdyaWQtdGVtcGxhdGUtYXJlYXM6IFwidGwgY2hhdGxvZ1wiXHIgXCJsb2dzIGNoYXRsb2dcIlxyIFwic3RhcnQgbWVzc2FnZVwiOyB9XG5cbi5pbmxpbmVzZXJ2ZXIge1xuICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgZ2FwOiAyZW07IH1cblxuLnNlcnZlcmxpbmsge1xuICB3aWR0aDogMjEwcHg7XG4gIGhlaWdodDogNDlweDtcbiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7IH1cbiAgLnNlcnZlcmxpbmsgdGV4dGFyZWEge1xuICAgIHJlc2l6ZTogbm9uZTtcbiAgICBib3JkZXI6IG5vbmU7XG4gICAgb3V0bGluZTogbm9uZTtcbiAgICBjb2xvcjogdmFyKC0tbWFpbi1jb2xvcik7XG4gICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICBmb250LXNpemU6IDI2cHg7XG4gICAgYWxpZ24tY29udGVudDogY2VudGVyO1xuICAgIHRleHQtZGVjb3JhdGlvbjogbm9uZTtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1saWdodC1iYWNrZ3JvdW5kKTtcbiAgICB3aWR0aDogMjEwcHg7XG4gICAgaGVpZ2h0OiAzMHB4OyB9XG5cbi5tZXNzYWdlIHtcbiAgZ3JpZC1hcmVhOiBtZXNzYWdlO1xuICBoZWlnaHQ6IDEwMCU7XG4gIHdpZHRoOiAxMDAlO1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyOyB9XG4gIC5tZXNzYWdlIHRleHRhcmVhIHtcbiAgICByZXNpemU6IG5vbmU7XG4gICAgYm9yZGVyOiBub25lO1xuICAgIGZvbnQtc2l6ZTogMjBweDtcbiAgICBvdXRsaW5lOiBub25lO1xuICAgIGNvbG9yOiB2YXIoLS1tYWluLWNvbG9yKTtcbiAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgIGFsaWduLWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB0ZXh0LWRlY29yYXRpb246IG5vbmU7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tbGlnaHQtYmFja2dyb3VuZCk7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgaGVpZ2h0OiAxMDBweDsgfVxuXG4uYmxncmlkIHtcbiAgYWxpZ24tc2VsZjogY2VudGVyO1xuICB3aWR0aDogY2FsYygzODhweCAtIDFlbSk7XG4gIGdhcDogM2VtO1xuICBmb250LXNpemU6IDE4cHg7XG4gIGZvbnQtd2VpZ2h0OiA2MDA7XG4gIHBhZGRpbmctbGVmdDogMWVtO1xuICBoZWlnaHQ6IDEwNHB4O1xuICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1saWdodC1iYWNrZ3JvdW5kKTtcbiAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGdyaWQtYXJlYTogc3RhcnQ7IH1cblxuLmxvZ3Mge1xuICB3aWR0aDogMzg4cHg7XG4gIGhlaWdodDogMzI3cHg7XG4gIGJhY2tncm91bmQtY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNDkwMik7XG4gIGdyaWQtYXJlYTogbG9nczsgfVxuICAubG9ncyAuaGVhZCB7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgcGFkZGluZzogOHB4OyB9XG5cbi5jaGF0bG9nIHtcbiAgd2lkdGg6IDQzNXB4O1xuICBoZWlnaHQ6IDEwMCU7XG4gIGdyaWQtYXJlYTogY2hhdGxvZztcbiAgYmFja2dyb3VuZC1jb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0OTAyKTsgfVxuICAuY2hhdGxvZyAuaGVhZCB7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgcGFkZGluZzogOHB4OyB9XG5cbi50bGdyaWQge1xuICBncmlkLWFyZWE6IHRsO1xuICBoZWlnaHQ6IDI1MHB4O1xuICB3aWR0aDogNTAlO1xuICBmbGV4LXdyYXA6IHdyYXA7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gIHJvdy1nYXA6IDJlbTtcbiAgY29sdW1uLWdhcDogMWVtOyB9XG48L3N0eWxlPlxyXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBOENtQixRQUFRLDhCQUFDLENBQUMsQUFDM0IsS0FBSyxDQUFFLEdBQUcsQ0FDVixNQUFNLENBQUUsS0FBSyxDQUNiLE9BQU8sQ0FBRSxJQUFJLENBQ2IscUJBQXFCLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FDOUIsa0JBQWtCLENBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQ25DLEdBQUcsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUNaLG1CQUFtQixDQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsZUFBZSxBQUFFLENBQUMsQUFFdkUsYUFBYSw4QkFBQyxDQUFDLEFBQ2IsT0FBTyxDQUFFLFdBQVcsQ0FDcEIsR0FBRyxDQUFFLEdBQUcsQUFBRSxDQUFDLEFBRWIsV0FBVyw4QkFBQyxDQUFDLEFBQ1gsS0FBSyxDQUFFLEtBQUssQ0FDWixNQUFNLENBQUUsSUFBSSxDQUNaLGVBQWUsQ0FBRSxNQUFNLENBQ3ZCLE9BQU8sQ0FBRSxJQUFJLENBQ2IsV0FBVyxDQUFFLE1BQU0sQUFBRSxDQUFDLEFBQ3RCLDBCQUFXLENBQUMsUUFBUSxlQUFDLENBQUMsQUFDcEIsTUFBTSxDQUFFLElBQUksQ0FDWixNQUFNLENBQUUsSUFBSSxDQUNaLE9BQU8sQ0FBRSxJQUFJLENBQ2IsS0FBSyxDQUFFLElBQUksWUFBWSxDQUFDLENBQ3hCLFFBQVEsQ0FBRSxNQUFNLENBQ2hCLFNBQVMsQ0FBRSxJQUFJLENBQ2YsYUFBYSxDQUFFLE1BQU0sQ0FDckIsZUFBZSxDQUFFLElBQUksQ0FDckIsZ0JBQWdCLENBQUUsSUFBSSxrQkFBa0IsQ0FBQyxDQUN6QyxLQUFLLENBQUUsS0FBSyxDQUNaLE1BQU0sQ0FBRSxJQUFJLEFBQUUsQ0FBQyxBQUVuQixRQUFRLDhCQUFDLENBQUMsQUFDUixTQUFTLENBQUUsT0FBTyxDQUNsQixNQUFNLENBQUUsSUFBSSxDQUNaLEtBQUssQ0FBRSxJQUFJLENBQ1gsT0FBTyxDQUFFLElBQUksQ0FDYixXQUFXLENBQUUsTUFBTSxBQUFFLENBQUMsQUFDdEIsdUJBQVEsQ0FBQyxRQUFRLGVBQUMsQ0FBQyxBQUNqQixNQUFNLENBQUUsSUFBSSxDQUNaLE1BQU0sQ0FBRSxJQUFJLENBQ1osU0FBUyxDQUFFLElBQUksQ0FDZixPQUFPLENBQUUsSUFBSSxDQUNiLEtBQUssQ0FBRSxJQUFJLFlBQVksQ0FBQyxDQUN4QixRQUFRLENBQUUsTUFBTSxDQUNoQixhQUFhLENBQUUsTUFBTSxDQUNyQixlQUFlLENBQUUsSUFBSSxDQUNyQixnQkFBZ0IsQ0FBRSxJQUFJLGtCQUFrQixDQUFDLENBQ3pDLEtBQUssQ0FBRSxJQUFJLENBQ1gsTUFBTSxDQUFFLEtBQUssQUFBRSxDQUFDLEFBRXBCLE9BQU8sOEJBQUMsQ0FBQyxBQUNQLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLEtBQUssQ0FBRSxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQ3hCLEdBQUcsQ0FBRSxHQUFHLENBQ1IsU0FBUyxDQUFFLElBQUksQ0FDZixXQUFXLENBQUUsR0FBRyxDQUNoQixZQUFZLENBQUUsR0FBRyxDQUNqQixNQUFNLENBQUUsS0FBSyxDQUNiLGdCQUFnQixDQUFFLElBQUksa0JBQWtCLENBQUMsQ0FDekMsT0FBTyxDQUFFLFdBQVcsQ0FDcEIsV0FBVyxDQUFFLE1BQU0sQ0FDbkIsU0FBUyxDQUFFLEtBQUssQUFBRSxDQUFDLEFBRXJCLEtBQUssOEJBQUMsQ0FBQyxBQUNMLEtBQUssQ0FBRSxLQUFLLENBQ1osTUFBTSxDQUFFLEtBQUssQ0FDYixnQkFBZ0IsQ0FBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUM5QyxTQUFTLENBQUUsSUFBSSxBQUFFLENBQUMsQUFDbEIsb0JBQUssQ0FBQyxLQUFLLGVBQUMsQ0FBQyxBQUNYLEtBQUssQ0FBRSxJQUFJLENBQ1gsT0FBTyxDQUFFLEdBQUcsQUFBRSxDQUFDLEFBRW5CLFFBQVEsOEJBQUMsQ0FBQyxBQUNSLEtBQUssQ0FBRSxLQUFLLENBQ1osTUFBTSxDQUFFLElBQUksQ0FDWixTQUFTLENBQUUsT0FBTyxDQUNsQixnQkFBZ0IsQ0FBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxBQUFFLENBQUMsQUFDakQsdUJBQVEsQ0FBQyxLQUFLLGVBQUMsQ0FBQyxBQUNkLEtBQUssQ0FBRSxJQUFJLENBQ1gsT0FBTyxDQUFFLEdBQUcsQUFBRSxDQUFDLEFBRW5CLE9BQU8sOEJBQUMsQ0FBQyxBQUNQLFNBQVMsQ0FBRSxFQUFFLENBQ2IsTUFBTSxDQUFFLEtBQUssQ0FDYixLQUFLLENBQUUsR0FBRyxDQUNWLFNBQVMsQ0FBRSxJQUFJLENBQ2YsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxDQUN0QixPQUFPLENBQUUsR0FBRyxDQUNaLFVBQVUsQ0FBRSxHQUFHLEFBQUUsQ0FBQyJ9 */");
    }

    function create_fragment$5(ctx) {
    	let div13;
    	let div5;
    	let div0;
    	let t1;
    	let div1;
    	let t3;
    	let div4;
    	let div2;
    	let t5;
    	let div3;
    	let textarea0;
    	let t6;
    	let div7;
    	let div6;
    	let t8;
    	let div9;
    	let div8;
    	let t10;
    	let swtich;
    	let updating_checked;
    	let t11;
    	let div11;
    	let div10;
    	let t13;
    	let div12;
    	let textarea1;
    	let current;
    	let mounted;
    	let dispose;

    	function swtich_checked_binding(value) {
    		/*swtich_checked_binding*/ ctx[4](value);
    	}

    	let swtich_props = {};

    	if (/*stopstart*/ ctx[2] !== void 0) {
    		swtich_props.checked = /*stopstart*/ ctx[2];
    	}

    	swtich = new Switch({ props: swtich_props, $$inline: true });
    	binding_callbacks.push(() => bind(swtich, 'checked', swtich_checked_binding));

    	const block = {
    		c: function create() {
    			div13 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			div0.textContent = "PROXIES";
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "TOKENS";
    			t3 = space();
    			div4 = element("div");
    			div2 = element("div");
    			div2.textContent = "JOIN SERVER";
    			t5 = space();
    			div3 = element("div");
    			textarea0 = element("textarea");
    			t6 = space();
    			div7 = element("div");
    			div6 = element("div");
    			div6.textContent = "Logs";
    			t8 = space();
    			div9 = element("div");
    			div8 = element("div");
    			div8.textContent = "Stop Start Chatbot";
    			t10 = space();
    			create_component(swtich.$$.fragment);
    			t11 = space();
    			div11 = element("div");
    			div10 = element("div");
    			div10.textContent = "Chatlog";
    			t13 = space();
    			div12 = element("div");
    			textarea1 = element("textarea");
    			attr_dev(div0, "class", "btn grad");
    			add_location(div0, file$5, 13, 4, 237);
    			attr_dev(div1, "class", "btn grad");
    			add_location(div1, file$5, 14, 4, 310);
    			attr_dev(div2, "class", "btn grad");
    			add_location(div2, file$5, 16, 6, 416);
    			attr_dev(textarea0, "placeholder", "Server link");
    			attr_dev(textarea0, "name", "serverlink");
    			attr_dev(textarea0, "id", "sl");
    			attr_dev(textarea0, "cols", "30");
    			attr_dev(textarea0, "rows", "10");
    			attr_dev(textarea0, "class", "svelte-1ymzol6");
    			add_location(textarea0, file$5, 18, 8, 526);
    			attr_dev(div3, "class", "serverlink svelte-1ymzol6");
    			add_location(div3, file$5, 17, 6, 492);
    			attr_dev(div4, "class", "inlineserver svelte-1ymzol6");
    			add_location(div4, file$5, 15, 4, 382);
    			attr_dev(div5, "class", "tlgrid svelte-1ymzol6");
    			add_location(div5, file$5, 12, 2, 211);
    			attr_dev(div6, "class", "head svelte-1ymzol6");
    			add_location(div6, file$5, 28, 20, 756);
    			attr_dev(div7, "class", "logs svelte-1ymzol6");
    			add_location(div7, file$5, 28, 2, 738);
    			add_location(div8, file$5, 30, 4, 820);
    			attr_dev(div9, "class", "blgrid svelte-1ymzol6");
    			add_location(div9, file$5, 29, 2, 794);
    			attr_dev(div10, "class", "head svelte-1ymzol6");
    			add_location(div10, file$5, 33, 23, 925);
    			attr_dev(div11, "class", "chatlog svelte-1ymzol6");
    			add_location(div11, file$5, 33, 2, 904);
    			attr_dev(textarea1, "placeholder", "Enter text message");
    			attr_dev(textarea1, "name", "message");
    			attr_dev(textarea1, "id", "m");
    			attr_dev(textarea1, "cols", "30");
    			attr_dev(textarea1, "rows", "10");
    			attr_dev(textarea1, "class", "svelte-1ymzol6");
    			add_location(textarea1, file$5, 35, 4, 993);
    			attr_dev(div12, "class", "message svelte-1ymzol6");
    			add_location(div12, file$5, 34, 2, 966);
    			attr_dev(div13, "class", "content svelte-1ymzol6");
    			add_location(div13, file$5, 11, 0, 186);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div13, anchor);
    			append_dev(div13, div5);
    			append_dev(div5, div0);
    			append_dev(div5, t1);
    			append_dev(div5, div1);
    			append_dev(div5, t3);
    			append_dev(div5, div4);
    			append_dev(div4, div2);
    			append_dev(div4, t5);
    			append_dev(div4, div3);
    			append_dev(div3, textarea0);
    			set_input_value(textarea0, /*serverlink*/ ctx[0]);
    			append_dev(div13, t6);
    			append_dev(div13, div7);
    			append_dev(div7, div6);
    			append_dev(div13, t8);
    			append_dev(div13, div9);
    			append_dev(div9, div8);
    			append_dev(div9, t10);
    			mount_component(swtich, div9, null);
    			append_dev(div13, t11);
    			append_dev(div13, div11);
    			append_dev(div11, div10);
    			append_dev(div13, t13);
    			append_dev(div13, div12);
    			append_dev(div12, textarea1);
    			set_input_value(textarea1, /*message*/ ctx[1]);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div0, "click", openProxyWindow, false, false, false),
    					listen_dev(div1, "click", openTokenWindow, false, false, false),
    					listen_dev(div2, "click", joinServer(), false, false, false),
    					listen_dev(textarea0, "input", /*textarea0_input_handler*/ ctx[3]),
    					listen_dev(textarea1, "input", /*textarea1_input_handler*/ ctx[5])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*serverlink*/ 1) {
    				set_input_value(textarea0, /*serverlink*/ ctx[0]);
    			}

    			const swtich_changes = {};

    			if (!updating_checked && dirty & /*stopstart*/ 4) {
    				updating_checked = true;
    				swtich_changes.checked = /*stopstart*/ ctx[2];
    				add_flush_callback(() => updating_checked = false);
    			}

    			swtich.$set(swtich_changes);

    			if (dirty & /*message*/ 2) {
    				set_input_value(textarea1, /*message*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(swtich.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(swtich.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div13);
    			destroy_component(swtich);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Chatlist', slots, []);
    	let serverlink;
    	let message;
    	let stopstart = false;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Chatlist> was created with unknown prop '${key}'`);
    	});

    	function textarea0_input_handler() {
    		serverlink = this.value;
    		$$invalidate(0, serverlink);
    	}

    	function swtich_checked_binding(value) {
    		stopstart = value;
    		$$invalidate(2, stopstart);
    	}

    	function textarea1_input_handler() {
    		message = this.value;
    		$$invalidate(1, message);
    	}

    	$$self.$capture_state = () => ({
    		core,
    		Swtich: Switch,
    		serverlink,
    		message,
    		stopstart
    	});

    	$$self.$inject_state = $$props => {
    		if ('serverlink' in $$props) $$invalidate(0, serverlink = $$props.serverlink);
    		if ('message' in $$props) $$invalidate(1, message = $$props.message);
    		if ('stopstart' in $$props) $$invalidate(2, stopstart = $$props.stopstart);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		serverlink,
    		message,
    		stopstart,
    		textarea0_input_handler,
    		swtich_checked_binding,
    		textarea1_input_handler
    	];
    }

    class Chatlist extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {}, add_css$5);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Chatlist",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* node_modules\svelte-slider\src\Rail.svelte generated by Svelte v3.46.4 */

    const file$4 = "node_modules\\svelte-slider\\src\\Rail.svelte";

    function add_css$4(target) {
    	append_styles(target, "svelte-1u5xdj2", ".rail.svelte-1u5xdj2{position:relative;height:2px;background:var(--sliderSecondary)}.selected.svelte-1u5xdj2{position:absolute;left:0;right:0;top:0;bottom:0;background:var(--sliderPrimary)}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUmFpbC5zdmVsdGUiLCJzb3VyY2VzIjpbIlJhaWwuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGV4cG9ydCBsZXQgdmFsdWU7XG48L3NjcmlwdD5cblxuPGRpdiBjbGFzcz1cInJhaWxcIj5cbiAgPGRpdiBjbGFzcz1cInNlbGVjdGVkXCIgc3R5bGU9XCJsZWZ0OiB7dmFsdWVbMF0gKiAxMDB9JTsgcmlnaHQ6IHsoMSAtIHZhbHVlWzFdKSAqIDEwMH0lO1wiPjwvZGl2PlxuICA8c2xvdD48L3Nsb3Q+XG48L2Rpdj5cblxuPHN0eWxlPlxuICAucmFpbCB7XG4gICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgIGhlaWdodDogMnB4O1xuICAgIGJhY2tncm91bmQ6IHZhcigtLXNsaWRlclNlY29uZGFyeSk7XG4gIH1cblxuICAuc2VsZWN0ZWQge1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICBsZWZ0OiAwO1xuICAgIHJpZ2h0OiAwO1xuICAgIHRvcDogMDtcbiAgICBib3R0b206IDA7XG4gICAgYmFja2dyb3VuZDogdmFyKC0tc2xpZGVyUHJpbWFyeSk7XG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBVUUsS0FBSyxlQUFDLENBQUMsQUFDTCxRQUFRLENBQUUsUUFBUSxDQUNsQixNQUFNLENBQUUsR0FBRyxDQUNYLFVBQVUsQ0FBRSxJQUFJLGlCQUFpQixDQUFDLEFBQ3BDLENBQUMsQUFFRCxTQUFTLGVBQUMsQ0FBQyxBQUNULFFBQVEsQ0FBRSxRQUFRLENBQ2xCLElBQUksQ0FBRSxDQUFDLENBQ1AsS0FBSyxDQUFFLENBQUMsQ0FDUixHQUFHLENBQUUsQ0FBQyxDQUNOLE1BQU0sQ0FBRSxDQUFDLENBQ1QsVUFBVSxDQUFFLElBQUksZUFBZSxDQUFDLEFBQ2xDLENBQUMifQ== */");
    }

    function create_fragment$4(ctx) {
    	let div1;
    	let div0;
    	let t;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t = space();
    			if (default_slot) default_slot.c();
    			attr_dev(div0, "class", "selected svelte-1u5xdj2");
    			set_style(div0, "left", /*value*/ ctx[0][0] * 100 + "%");
    			set_style(div0, "right", (1 - /*value*/ ctx[0][1]) * 100 + "%");
    			add_location(div0, file$4, 5, 2, 61);
    			attr_dev(div1, "class", "rail svelte-1u5xdj2");
    			add_location(div1, file$4, 4, 0, 40);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div1, t);

    			if (default_slot) {
    				default_slot.m(div1, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*value*/ 1) {
    				set_style(div0, "left", /*value*/ ctx[0][0] * 100 + "%");
    			}

    			if (!current || dirty & /*value*/ 1) {
    				set_style(div0, "right", (1 - /*value*/ ctx[0][1]) * 100 + "%");
    			}

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Rail', slots, ['default']);
    	let { value } = $$props;
    	const writable_props = ['value'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Rail> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    		if ('$$scope' in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ value });

    	$$self.$inject_state = $$props => {
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [value, $$scope, slots];
    }

    class Rail extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { value: 0 }, add_css$4);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Rail",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*value*/ ctx[0] === undefined && !('value' in props)) {
    			console.warn("<Rail> was created without expected prop 'value'");
    		}
    	}

    	get value() {
    		throw new Error("<Rail>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Rail>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-slider\src\Thumb.svelte generated by Svelte v3.46.4 */
    const file$3 = "node_modules\\svelte-slider\\src\\Thumb.svelte";

    function add_css$3(target) {
    	append_styles(target, "svelte-1p2qw86", ".thumb.svelte-1p2qw86{width:16px;height:16px;position:absolute;left:0;top:50%;border-radius:50%;background:var(--sliderPrimary);touch-action:none;transform:translate(-50%, -50%);transition:.2s height, .2s width}.thumb.svelte-1p2qw86:after{content:'';position:absolute;left:50%;top:50%;width:32px;height:32px;transform:translate(-50%, -50%);cursor:pointer}.thumb.svelte-1p2qw86:before{content:'';position:absolute;left:50%;top:50%;width:32px;height:32px;border-radius:50%;opacity:0.3;background:var(--sliderSecondary);transform:translate(-50%, -50%) scale(0);transition:.2s all}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGh1bWIuc3ZlbHRlIiwic291cmNlcyI6WyJUaHVtYi5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cbiAgaW1wb3J0IHsgb25Nb3VudCwgY3JlYXRlRXZlbnREaXNwYXRjaGVyIH0gZnJvbSAnc3ZlbHRlJztcblxuICBleHBvcnQgbGV0IHBvc2l0aW9uO1xuXG4gIGxldCB0aHVtYjtcbiAgbGV0IGJib3g7XG4gIGNvbnN0IGRpc3BhdGNoID0gY3JlYXRlRXZlbnREaXNwYXRjaGVyKCk7XG5cbiAgZnVuY3Rpb24gaGFuZGxlU3RhcnQoZXZlbnQpIHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGNvbnN0IHggPSBldmVudC5jbGllbnRYO1xuICAgIGNvbnN0IGJib3ggPSBldmVudC50YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgdGh1bWIuc2V0UG9pbnRlckNhcHR1cmUoZXZlbnQucG9pbnRlcklkKTtcbiAgICB0aHVtYi5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsIGhhbmRsZU1vdmUpO1xuICAgIHRodW1iLmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJ1cCcsIGhhbmRsZUVuZCk7XG4gICAgZGlzcGF0Y2goJ2RyYWdzdGFydCcsIHsgeCwgYmJveCB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGhhbmRsZU1vdmUoZXZlbnQpIHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGNvbnN0IHggPSBldmVudC5jbGllbnRYO1xuICAgIGNvbnN0IGJib3ggPSBldmVudC50YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgZGlzcGF0Y2goJ2RyYWdnaW5nJywgeyB4LCBiYm94IH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gaGFuZGxlRW5kKGV2ZW50KSB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0aHVtYi5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsIGhhbmRsZU1vdmUpO1xuICAgIHRodW1iLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJ1cCcsIGhhbmRsZUVuZCk7XG4gICAgZGlzcGF0Y2goJ2RyYWdlbmQnKTtcbiAgfVxuXG4gIG9uTW91bnQoKCkgPT4ge1xuICAgIHRodW1iLmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgaGFuZGxlU3RhcnQpO1xuICB9KTtcbjwvc2NyaXB0PlxuXG48ZGl2XG4gIGJpbmQ6dGhpcz17dGh1bWJ9XG4gIGNsYXNzPVwidGh1bWJcIlxuICBzdHlsZT1cImxlZnQ6IHtwb3NpdGlvbiAqIDEwMH0lO1wiXG4gIG9uOnN0YXJ0PXtoYW5kbGVTdGFydH1cbiAgb246bW92ZT17aGFuZGxlTW92ZX1cbiAgb246ZW5kPXtoYW5kbGVFbmR9XG4+XG48L2Rpdj5cblxuPHN0eWxlPlxuICAudGh1bWIge1xuICAgIHdpZHRoOiAxNnB4O1xuICAgIGhlaWdodDogMTZweDtcbiAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgbGVmdDogMDtcbiAgICB0b3A6IDUwJTtcbiAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgYmFja2dyb3VuZDogdmFyKC0tc2xpZGVyUHJpbWFyeSk7XG4gICAgdG91Y2gtYWN0aW9uOiBub25lO1xuICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgIHRyYW5zaXRpb246IC4ycyBoZWlnaHQsIC4ycyB3aWR0aDtcbiAgfVxuXG4gIC50aHVtYjphZnRlciB7XG4gICAgY29udGVudDogJyc7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIGxlZnQ6IDUwJTtcbiAgICB0b3A6IDUwJTtcbiAgICB3aWR0aDogMzJweDtcbiAgICBoZWlnaHQ6IDMycHg7XG4gICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgY3Vyc29yOiBwb2ludGVyO1xuICB9XG5cbiAgLnRodW1iOmJlZm9yZSB7XG4gICAgY29udGVudDogJyc7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIGxlZnQ6IDUwJTtcbiAgICB0b3A6IDUwJTtcbiAgICB3aWR0aDogMzJweDtcbiAgICBoZWlnaHQ6IDMycHg7XG4gICAgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgIG9wYWNpdHk6IDAuMztcbiAgICBiYWNrZ3JvdW5kOiB2YXIoLS1zbGlkZXJTZWNvbmRhcnkpO1xuICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpIHNjYWxlKDApO1xuICAgIHRyYW5zaXRpb246IC4ycyBhbGw7XG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBaURFLE1BQU0sZUFBQyxDQUFDLEFBQ04sS0FBSyxDQUFFLElBQUksQ0FDWCxNQUFNLENBQUUsSUFBSSxDQUNaLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLElBQUksQ0FBRSxDQUFDLENBQ1AsR0FBRyxDQUFFLEdBQUcsQ0FDUixhQUFhLENBQUUsR0FBRyxDQUNsQixVQUFVLENBQUUsSUFBSSxlQUFlLENBQUMsQ0FDaEMsWUFBWSxDQUFFLElBQUksQ0FDbEIsU0FBUyxDQUFFLFVBQVUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQ2hDLFVBQVUsQ0FBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQUFDbkMsQ0FBQyxBQUVELHFCQUFNLE1BQU0sQUFBQyxDQUFDLEFBQ1osT0FBTyxDQUFFLEVBQUUsQ0FDWCxRQUFRLENBQUUsUUFBUSxDQUNsQixJQUFJLENBQUUsR0FBRyxDQUNULEdBQUcsQ0FBRSxHQUFHLENBQ1IsS0FBSyxDQUFFLElBQUksQ0FDWCxNQUFNLENBQUUsSUFBSSxDQUNaLFNBQVMsQ0FBRSxVQUFVLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUNoQyxNQUFNLENBQUUsT0FBTyxBQUNqQixDQUFDLEFBRUQscUJBQU0sT0FBTyxBQUFDLENBQUMsQUFDYixPQUFPLENBQUUsRUFBRSxDQUNYLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLElBQUksQ0FBRSxHQUFHLENBQ1QsR0FBRyxDQUFFLEdBQUcsQ0FDUixLQUFLLENBQUUsSUFBSSxDQUNYLE1BQU0sQ0FBRSxJQUFJLENBQ1osYUFBYSxDQUFFLEdBQUcsQ0FDbEIsT0FBTyxDQUFFLEdBQUcsQ0FDWixVQUFVLENBQUUsSUFBSSxpQkFBaUIsQ0FBQyxDQUNsQyxTQUFTLENBQUUsVUFBVSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUN6QyxVQUFVLENBQUUsR0FBRyxDQUFDLEdBQUcsQUFDckIsQ0FBQyJ9 */");
    }

    function create_fragment$3(ctx) {
    	let div;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "thumb svelte-1p2qw86");
    			set_style(div, "left", /*position*/ ctx[0] * 100 + "%");
    			add_location(div, file$3, 38, 0, 984);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			/*div_binding*/ ctx[5](div);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div, "start", /*handleStart*/ ctx[2], false, false, false),
    					listen_dev(div, "move", /*handleMove*/ ctx[3], false, false, false),
    					listen_dev(div, "end", /*handleEnd*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*position*/ 1) {
    				set_style(div, "left", /*position*/ ctx[0] * 100 + "%");
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[5](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Thumb', slots, []);
    	let { position } = $$props;
    	let thumb;
    	let bbox;
    	const dispatch = createEventDispatcher();

    	function handleStart(event) {
    		event.preventDefault();
    		const x = event.clientX;
    		const bbox = event.target.getBoundingClientRect();
    		thumb.setPointerCapture(event.pointerId);
    		thumb.addEventListener('pointermove', handleMove);
    		thumb.addEventListener('pointerup', handleEnd);
    		dispatch('dragstart', { x, bbox });
    	}

    	function handleMove(event) {
    		event.preventDefault();
    		const x = event.clientX;
    		const bbox = event.target.getBoundingClientRect();
    		dispatch('dragging', { x, bbox });
    	}

    	function handleEnd(event) {
    		event.preventDefault();
    		thumb.removeEventListener('pointermove', handleMove);
    		thumb.removeEventListener('pointerup', handleEnd);
    		dispatch('dragend');
    	}

    	onMount(() => {
    		thumb.addEventListener('pointerdown', handleStart);
    	});

    	const writable_props = ['position'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Thumb> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			thumb = $$value;
    			$$invalidate(1, thumb);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('position' in $$props) $$invalidate(0, position = $$props.position);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		createEventDispatcher,
    		position,
    		thumb,
    		bbox,
    		dispatch,
    		handleStart,
    		handleMove,
    		handleEnd
    	});

    	$$self.$inject_state = $$props => {
    		if ('position' in $$props) $$invalidate(0, position = $$props.position);
    		if ('thumb' in $$props) $$invalidate(1, thumb = $$props.thumb);
    		if ('bbox' in $$props) bbox = $$props.bbox;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [position, thumb, handleStart, handleMove, handleEnd, div_binding];
    }

    class Thumb extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { position: 0 }, add_css$3);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Thumb",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*position*/ ctx[0] === undefined && !('position' in props)) {
    			console.warn("<Thumb> was created without expected prop 'position'");
    		}
    	}

    	get position() {
    		throw new Error("<Thumb>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set position(value) {
    		throw new Error("<Thumb>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-slider\src\Slider.svelte generated by Svelte v3.46.4 */

    const { console: console_1 } = globals;
    const file$2 = "node_modules\\svelte-slider\\src\\Slider.svelte";

    function add_css$2(target) {
    	append_styles(target, "svelte-1cw3o64", ".slider.svelte-1cw3o64{padding:8px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2xpZGVyLnN2ZWx0ZSIsInNvdXJjZXMiOlsiU2xpZGVyLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICBpbXBvcnQgeyBjcmVhdGVFdmVudERpc3BhdGNoZXIgfSBmcm9tICdzdmVsdGUnO1xuICBpbXBvcnQgUmFpbCBmcm9tICcuL1JhaWwuc3ZlbHRlJztcbiAgaW1wb3J0IFRodW1iIGZyb20gJy4vVGh1bWIuc3ZlbHRlJztcblxuICBleHBvcnQgbGV0IHZhbHVlID0gWzAsIDFdO1xuICBleHBvcnQgbGV0IHNpbmdsZSA9IGZhbHNlO1xuXG4gIGxldCBjb250YWluZXI7XG4gIGxldCBhY3RpdmVJbmRleDtcbiAgbGV0IG9mZnNldDtcbiAgbGV0IGRpc3BhdGNoID0gY3JlYXRlRXZlbnREaXNwYXRjaGVyKCk7XG5cbiAgZnVuY3Rpb24gZ2V0U3RhcnRMaXN0ZW5lcihpbmRleCkge1xuICAgIHJldHVybiAoZXZlbnQpID0+IHtcbiAgICAgIGFjdGl2ZUluZGV4ID0gaW5kZXg7XG4gICAgICBjb25zdCB7IGJib3ggfSA9IGV2ZW50LmRldGFpbDtcbiAgICAgIG9mZnNldCA9IGJib3gud2lkdGggLyAyIC0gKGV2ZW50LmRldGFpbC54IC0gYmJveC5sZWZ0KTtcbiAgICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1vdmVMaXN0ZW5lcihldmVudCkge1xuICAgIGNvbnN0IGJib3ggPSBjb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgY29uc3QgeyB4IH0gPSBldmVudC5kZXRhaWw7XG4gICAgbGV0IHBvc2l0aW9uID0gKHggLSBiYm94LmxlZnQgKyBvZmZzZXQpIC8gYmJveC53aWR0aDtcblxuICAgIGlmIChwb3NpdGlvbiA8IDApIHtcbiAgICAgIHBvc2l0aW9uID0gMDtcbiAgICB9IGVsc2UgaWYgKHBvc2l0aW9uID4gMSkge1xuICAgICAgcG9zaXRpb24gPSAxO1xuICAgIH1cblxuICAgIGlmIChhY3RpdmVJbmRleCA9PT0gMCAmJiB2YWx1ZVswXSA+IHZhbHVlWzFdKSB7XG4gICAgICBhY3RpdmVJbmRleCA9IDE7XG4gICAgICB2YWx1ZVswXSA9IHZhbHVlWzFdO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoYWN0aXZlSW5kZXggPT09IDEgJiYgdmFsdWVbMV0gPCB2YWx1ZVswXSkge1xuICAgICAgYWN0aXZlSW5kZXggPSAwO1xuICAgICAgdmFsdWVbMV0gPSB2YWx1ZVswXTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodmFsdWVbYWN0aXZlSW5kZXhdID09PSBwb3NpdGlvbikgcmV0dXJuO1xuICAgIHZhbHVlW2FjdGl2ZUluZGV4XSA9IHBvc2l0aW9uO1xuICAgIGRpc3BhdGNoKCdjaGFuZ2UnLCB2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBlbmRMaXN0ZW5lcigpIHtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gb25TZXQoZXZlbnQpIHtcbiAgICBjb25zb2xlLmxvZyhldmVudC5kZXRhaWwpO1xuICB9XG48L3NjcmlwdD5cblxuPGRpdiBjbGFzcz1cInNsaWRlclwiPlxuICA8ZGl2IGJpbmQ6dGhpcz17Y29udGFpbmVyfT5cbiAgICA8UmFpbCB7dmFsdWV9IG9uOnNldD17b25TZXR9PlxuICAgICAgeyNpZiAhc2luZ2xlfVxuICAgICAgICA8VGh1bWJcbiAgICAgICAgICBwb3NpdGlvbj17dmFsdWVbMF19XG4gICAgICAgICAgb246ZHJhZ3N0YXJ0PXtnZXRTdGFydExpc3RlbmVyKDApfVxuICAgICAgICAgIG9uOmRyYWdnaW5nPXttb3ZlTGlzdGVuZXJ9XG4gICAgICAgICAgb246ZHJhZ2VuZD17ZW5kTGlzdGVuZXJ9XG4gICAgICAgIC8+XG4gICAgICB7L2lmfVxuICAgICAgPFRodW1iXG4gICAgICAgIHBvc2l0aW9uPXt2YWx1ZVsxXX1cbiAgICAgICAgb246ZHJhZ3N0YXJ0PXtnZXRTdGFydExpc3RlbmVyKDEpfVxuICAgICAgICBvbjpkcmFnZ2luZz17bW92ZUxpc3RlbmVyfVxuICAgICAgICBvbjpkcmFnZW5kPXtlbmRMaXN0ZW5lcn1cbiAgICAgIC8+XG4gICAgPC9SYWlsPlxuICA8L2Rpdj5cbjwvZGl2PlxuXG48c3R5bGU+XG4gIC5zbGlkZXIge1xuICAgIHBhZGRpbmc6IDhweDtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUErRUUsT0FBTyxlQUFDLENBQUMsQUFDUCxPQUFPLENBQUUsR0FBRyxBQUNkLENBQUMifQ== */");
    }

    // (61:6) {#if !single}
    function create_if_block(ctx) {
    	let thumb;
    	let current;

    	thumb = new Thumb({
    			props: { position: /*value*/ ctx[0][0] },
    			$$inline: true
    		});

    	thumb.$on("dragstart", /*getStartListener*/ ctx[3](0));
    	thumb.$on("dragging", /*moveListener*/ ctx[4]);
    	thumb.$on("dragend", endListener);

    	const block = {
    		c: function create() {
    			create_component(thumb.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(thumb, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const thumb_changes = {};
    			if (dirty & /*value*/ 1) thumb_changes.position = /*value*/ ctx[0][0];
    			thumb.$set(thumb_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(thumb.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(thumb.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(thumb, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(61:6) {#if !single}",
    		ctx
    	});

    	return block;
    }

    // (60:4) <Rail {value} on:set={onSet}>
    function create_default_slot(ctx) {
    	let t;
    	let thumb;
    	let current;
    	let if_block = !/*single*/ ctx[1] && create_if_block(ctx);

    	thumb = new Thumb({
    			props: { position: /*value*/ ctx[0][1] },
    			$$inline: true
    		});

    	thumb.$on("dragstart", /*getStartListener*/ ctx[3](1));
    	thumb.$on("dragging", /*moveListener*/ ctx[4]);
    	thumb.$on("dragend", endListener);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			t = space();
    			create_component(thumb.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(thumb, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*single*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*single*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t.parentNode, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			const thumb_changes = {};
    			if (dirty & /*value*/ 1) thumb_changes.position = /*value*/ ctx[0][1];
    			thumb.$set(thumb_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(thumb.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(thumb.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(thumb, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(60:4) <Rail {value} on:set={onSet}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div1;
    	let div0;
    	let rail;
    	let current;

    	rail = new Rail({
    			props: {
    				value: /*value*/ ctx[0],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	rail.$on("set", onSet);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			create_component(rail.$$.fragment);
    			add_location(div0, file$2, 58, 2, 1338);
    			attr_dev(div1, "class", "slider svelte-1cw3o64");
    			add_location(div1, file$2, 57, 0, 1315);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			mount_component(rail, div0, null);
    			/*div0_binding*/ ctx[5](div0);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const rail_changes = {};
    			if (dirty & /*value*/ 1) rail_changes.value = /*value*/ ctx[0];

    			if (dirty & /*$$scope, value, single*/ 515) {
    				rail_changes.$$scope = { dirty, ctx };
    			}

    			rail.$set(rail_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(rail.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(rail.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(rail);
    			/*div0_binding*/ ctx[5](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function endListener() {
    	document.body.style.cursor = '';
    }

    function onSet(event) {
    	console.log(event.detail);
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Slider', slots, []);
    	let { value = [0, 1] } = $$props;
    	let { single = false } = $$props;
    	let container;
    	let activeIndex;
    	let offset;
    	let dispatch = createEventDispatcher();

    	function getStartListener(index) {
    		return event => {
    			activeIndex = index;
    			const { bbox } = event.detail;
    			offset = bbox.width / 2 - (event.detail.x - bbox.left);
    			document.body.style.cursor = 'pointer';
    		};
    	}

    	function moveListener(event) {
    		const bbox = container.getBoundingClientRect();
    		const { x } = event.detail;
    		let position = (x - bbox.left + offset) / bbox.width;

    		if (position < 0) {
    			position = 0;
    		} else if (position > 1) {
    			position = 1;
    		}

    		if (activeIndex === 0 && value[0] > value[1]) {
    			activeIndex = 1;
    			$$invalidate(0, value[0] = value[1], value);
    			return;
    		} else if (activeIndex === 1 && value[1] < value[0]) {
    			activeIndex = 0;
    			$$invalidate(0, value[1] = value[0], value);
    			return;
    		}

    		if (value[activeIndex] === position) return;
    		$$invalidate(0, value[activeIndex] = position, value);
    		dispatch('change', value);
    	}

    	const writable_props = ['value', 'single'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Slider> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			container = $$value;
    			$$invalidate(2, container);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    		if ('single' in $$props) $$invalidate(1, single = $$props.single);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		Rail,
    		Thumb,
    		value,
    		single,
    		container,
    		activeIndex,
    		offset,
    		dispatch,
    		getStartListener,
    		moveListener,
    		endListener,
    		onSet
    	});

    	$$self.$inject_state = $$props => {
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    		if ('single' in $$props) $$invalidate(1, single = $$props.single);
    		if ('container' in $$props) $$invalidate(2, container = $$props.container);
    		if ('activeIndex' in $$props) activeIndex = $$props.activeIndex;
    		if ('offset' in $$props) offset = $$props.offset;
    		if ('dispatch' in $$props) dispatch = $$props.dispatch;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [value, single, container, getStartListener, moveListener, div0_binding];
    }

    class Slider extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { value: 0, single: 1 }, add_css$2);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Slider",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get value() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get single() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set single(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src-svelte\pages\Settings.svelte generated by Svelte v3.46.4 */
    const file$1 = "src-svelte\\pages\\Settings.svelte";

    function add_css$1(target) {
    	append_styles(target, "svelte-htypwc", ".line.svelte-htypwc{display:inline-flex;gap:4em;align-items:center}.inner.svelte-htypwc{background-color:var(--light-background)}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2V0dGluZ3Muc3ZlbHRlIiwic291cmNlcyI6WyJTZXR0aW5ncy5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cclxuICAgIGltcG9ydCBTbGlkZXIgZnJvbSAnc3ZlbHRlLXNsaWRlcic7XHJcblxyXG4gICAgbGV0IGxpY2VuY2U7XHJcbiAgICB3aW5kb3cuX19UQVVSSV9fLmludm9rZSgnZ2V0X2xpY2VuY2UnKS50aGVuKChyZXQpID0+IGxpY2VuY2UgPSByZXQpO1xyXG48L3NjcmlwdD5cclxuXHJcbjxkaXYgY2xhc3M9XCJjb250YWluZXJcIj5cclxuICAgIDxkaXYgY2xhc3M9XCJsaW5lXCI+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImlubmVyXCI+XHJcbiAgICAgICAgICAgIEpvaW4gZGVsYXlcclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8U2xpZGVyLz5cclxuICAgIDwvZGl2PlxyXG4gICAgPGRpdiBjbGFzcz1cImxpbmVcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiaW5uZXJcIj5cclxuICAgICAgICAgICAgTWVzc2FnZSBkZWxheVxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDxTbGlkZXIvPlxyXG4gICAgPC9kaXY+XHJcbiAgICA8ZGl2IGNsYXNzPVwibGljZW5jZVwiPlxyXG4gICAgICAgIHtsaWNlbmNlfVxyXG4gICAgPC9kaXY+XHJcbjwvZGl2PlxyXG5cclxuPHN0eWxlIGxhbmc9XCJzY3NzXCI+LmxpbmUge1xuICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgZ2FwOiA0ZW07XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7IH1cblxuLmlubmVyIHtcbiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tbGlnaHQtYmFja2dyb3VuZCk7IH1cbjwvc3R5bGU+Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXlCbUIsS0FBSyxjQUFDLENBQUMsQUFDeEIsT0FBTyxDQUFFLFdBQVcsQ0FDcEIsR0FBRyxDQUFFLEdBQUcsQ0FDUixXQUFXLENBQUUsTUFBTSxBQUFFLENBQUMsQUFFeEIsTUFBTSxjQUFDLENBQUMsQUFDTixnQkFBZ0IsQ0FBRSxJQUFJLGtCQUFrQixDQUFDLEFBQUUsQ0FBQyJ9 */");
    }

    function create_fragment$1(ctx) {
    	let div5;
    	let div1;
    	let div0;
    	let t1;
    	let slider0;
    	let t2;
    	let div3;
    	let div2;
    	let t4;
    	let slider1;
    	let t5;
    	let div4;
    	let t6;
    	let current;
    	slider0 = new Slider({ $$inline: true });
    	slider1 = new Slider({ $$inline: true });

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			div0.textContent = "Join delay";
    			t1 = space();
    			create_component(slider0.$$.fragment);
    			t2 = space();
    			div3 = element("div");
    			div2 = element("div");
    			div2.textContent = "Message delay";
    			t4 = space();
    			create_component(slider1.$$.fragment);
    			t5 = space();
    			div4 = element("div");
    			t6 = text(/*licence*/ ctx[0]);
    			attr_dev(div0, "class", "inner svelte-htypwc");
    			add_location(div0, file$1, 9, 8, 215);
    			attr_dev(div1, "class", "line svelte-htypwc");
    			add_location(div1, file$1, 8, 4, 187);
    			attr_dev(div2, "class", "inner svelte-htypwc");
    			add_location(div2, file$1, 15, 8, 339);
    			attr_dev(div3, "class", "line svelte-htypwc");
    			add_location(div3, file$1, 14, 4, 311);
    			attr_dev(div4, "class", "licence");
    			add_location(div4, file$1, 20, 4, 438);
    			attr_dev(div5, "class", "container");
    			add_location(div5, file$1, 7, 0, 158);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div1);
    			append_dev(div1, div0);
    			append_dev(div1, t1);
    			mount_component(slider0, div1, null);
    			append_dev(div5, t2);
    			append_dev(div5, div3);
    			append_dev(div3, div2);
    			append_dev(div3, t4);
    			mount_component(slider1, div3, null);
    			append_dev(div5, t5);
    			append_dev(div5, div4);
    			append_dev(div4, t6);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*licence*/ 1) set_data_dev(t6, /*licence*/ ctx[0]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(slider0.$$.fragment, local);
    			transition_in(slider1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(slider0.$$.fragment, local);
    			transition_out(slider1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			destroy_component(slider0);
    			destroy_component(slider1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Settings', slots, []);
    	let licence;
    	window.__TAURI__.invoke('get_licence').then(ret => $$invalidate(0, licence = ret));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Settings> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Slider, licence });

    	$$self.$inject_state = $$props => {
    		if ('licence' in $$props) $$invalidate(0, licence = $$props.licence);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [licence];
    }

    class Settings extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {}, add_css$1);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Settings",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src-svelte\App.svelte generated by Svelte v3.46.4 */
    const file = "src-svelte\\App.svelte";

    function add_css(target) {
    	append_styles(target, "svelte-s6a9tu", ".content.svelte-s6a9tu{padding:8px;width:100%;height:100%;display:flex}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXBwLnN2ZWx0ZSIsInNvdXJjZXMiOlsiQXBwLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxyXG4gICAgaW1wb3J0IHsgb25Nb3VudCB9IGZyb20gJ3N2ZWx0ZSc7XHJcblxyXG4gICAgaW1wb3J0IE5hdmJhciBmcm9tICcuL2NvbXBvbmVudHMvTmF2YmFyLnN2ZWx0ZSc7XHJcbiAgICBpbXBvcnQgQ2hhdGxpc3QgZnJvbSAnLi9wYWdlcy9DaGF0bGlzdC5zdmVsdGUnO1xyXG4gICAgaW1wb3J0IFNldHRpbmdzIGZyb20gJy4vcGFnZXMvU2V0dGluZ3Muc3ZlbHRlJztcclxuXHJcbiAgICBjb25zdCBwYWdlcyA9IFtcclxuICAgICAgICBDaGF0bGlzdCxcclxuICAgICAgICBTZXR0aW5nc1xyXG4gICAgXVxyXG4gICAgbGV0IHBnbiA9IDA7XHJcbjwvc2NyaXB0PlxyXG5cclxuPE5hdmJhciBiaW5kOnBnbi8+XHJcbjxkaXYgY2xhc3M9XCJjb250ZW50XCI+XHJcbiAgICA8c3ZlbHRlOmNvbXBvbmVudCB0aGlzPXtwYWdlc1twZ25dfSAvPlxyXG48L2Rpdj5cclxuXHJcbjxzdHlsZSBsYW5nPVwic2Nzc1wiPi5jb250ZW50IHtcbiAgcGFkZGluZzogOHB4O1xuICB3aWR0aDogMTAwJTtcbiAgaGVpZ2h0OiAxMDAlO1xuICBkaXNwbGF5OiBmbGV4OyB9XG4gIC5jb250ZW50IGgxIHtcbiAgICBqdXN0aWZ5LXNlbGY6IGNlbnRlcjsgfVxuPC9zdHlsZT4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBbUJtQixRQUFRLGNBQUMsQ0FBQyxBQUMzQixPQUFPLENBQUUsR0FBRyxDQUNaLEtBQUssQ0FBRSxJQUFJLENBQ1gsTUFBTSxDQUFFLElBQUksQ0FDWixPQUFPLENBQUUsSUFBSSxBQUFFLENBQUMifQ== */");
    }

    function create_fragment(ctx) {
    	let navbar;
    	let updating_pgn;
    	let t;
    	let div;
    	let switch_instance;
    	let current;

    	function navbar_pgn_binding(value) {
    		/*navbar_pgn_binding*/ ctx[2](value);
    	}

    	let navbar_props = {};

    	if (/*pgn*/ ctx[0] !== void 0) {
    		navbar_props.pgn = /*pgn*/ ctx[0];
    	}

    	navbar = new Navbar({ props: navbar_props, $$inline: true });
    	binding_callbacks.push(() => bind(navbar, 'pgn', navbar_pgn_binding));
    	var switch_value = /*pages*/ ctx[1][/*pgn*/ ctx[0]];

    	function switch_props(ctx) {
    		return { $$inline: true };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			create_component(navbar.$$.fragment);
    			t = space();
    			div = element("div");
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			attr_dev(div, "class", "content svelte-s6a9tu");
    			add_location(div, file, 15, 0, 329);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(navbar, target, anchor);
    			insert_dev(target, t, anchor);
    			insert_dev(target, div, anchor);

    			if (switch_instance) {
    				mount_component(switch_instance, div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const navbar_changes = {};

    			if (!updating_pgn && dirty & /*pgn*/ 1) {
    				updating_pgn = true;
    				navbar_changes.pgn = /*pgn*/ ctx[0];
    				add_flush_callback(() => updating_pgn = false);
    			}

    			navbar.$set(navbar_changes);

    			if (switch_value !== (switch_value = /*pages*/ ctx[1][/*pgn*/ ctx[0]])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, div, null);
    				} else {
    					switch_instance = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(navbar, detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div);
    			if (switch_instance) destroy_component(switch_instance);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const pages = [Chatlist, Settings];
    	let pgn = 0;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function navbar_pgn_binding(value) {
    		pgn = value;
    		$$invalidate(0, pgn);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		Navbar,
    		Chatlist,
    		Settings,
    		pages,
    		pgn
    	});

    	$$self.$inject_state = $$props => {
    		if ('pgn' in $$props) $$invalidate(0, pgn = $$props.pgn);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [pgn, pages, navbar_pgn_binding];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, add_css);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
