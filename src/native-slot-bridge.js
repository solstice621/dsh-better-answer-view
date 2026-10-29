import React from 'react';

const PREFIX = 'better-view-for-dsh.native.';

/**
 * Keep DSH's own Markdown, image and reasoning renderers, including injection.
 * Child slot declarations have one owner in DSH, so a decorating renderer uses
 * private aliases instead of attempting to redeclare the native child names.
 */
export function registerNativeSlotBridge(ctx, base, decorate) {
  const disposers = [];
  const alias = name => `${PREFIX}${name}`;

  function bridge(entry, name, component, options = {}) {
    const children = entry.children;
    const childNames = Object.keys(children || {});
    const mappedChildren = Object.fromEntries(childNames.map(key => [alias(key), children[key]]));
    const Component = component || entry.component;
    function NativeWithAliases(props) {
      const renderSlot = childNames.length === 0 ? props.renderSlot
        : (key, owner, opts) => props.renderSlot(alias(key), owner, opts);
      const renderSlotChain = childNames.length === 0 ? props.renderSlotChain
        : (key, owner, opts) => props.renderSlotChain(alias(key), owner, opts);
      return React.createElement(Component, {...props, renderSlot, renderSlotChain});
    }
    const registration = {
      name,
      ...entry.options,
      ...(entry.select ? {select: entry.select} : {}),
      ...(entry.inject ? {inject: entry.inject} : {}),
      ...(entry.locale ? {locale: entry.locale} : {}),
      ...(entry.store ? {store: entry.store} : {}),
      ...(childNames.length ? {children: mappedChildren} : {}),
      ...options,
    };
    const stop = ctx.slots.register(registration, NativeWithAliases);
    const stopChildren = [];
    try {
      for (const child of childNames) stopChildren.push(mirror(child));
    } catch (error) {
      for (const dispose of stopChildren.reverse()) dispose();
      stop();
      throw error;
    }
    return () => {
      for (const dispose of stopChildren.reverse()) dispose();
      stop();
    };
  }

  function mirror(originalName) {
    let lastEntries;
    let stopEntries = [];
    let stopped = false;
    const reconcile = () => {
      if (stopped) return;
      const entries = ctx.slots.entries(originalName);
      if (entries === lastEntries) return;
      lastEntries = entries;
      for (const dispose of stopEntries.reverse()) dispose();
      stopEntries = [];
      for (const entry of entries) stopEntries.push(bridge(entry, alias(originalName)));
    };
    try { reconcile(); }
    catch (error) {
      for (const dispose of stopEntries.reverse()) dispose();
      throw error;
    }
    const unsubscribe = ctx.slots.subscribe(originalName, reconcile);
    return () => {
      stopped = true;
      unsubscribe();
      for (const dispose of stopEntries.reverse()) dispose();
    };
  }

  try {
    disposers.push(bridge(base, 'conversation.chat.node', decorate(base.component), {
      key: 'assistant-step',
      priority: (base.options.priority ?? 0) - 100,
    }));
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose();
    throw error;
  }
  return () => { for (const dispose of disposers.reverse()) dispose(); };
}
