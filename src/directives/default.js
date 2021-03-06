/* ======= Default Directives ======= */

const emptyVNode = `h("#text", ${generateMeta(defaultMetadata())}"")`;

specialDirectives["m-if"] = {
  afterGenerate: function(prop, code, vnode, state) {
    const value = prop.value;
    compileTemplateExpression(value, state.dependencies);
    return `${value} ? ${code} : ${emptyVNode}`;
  }
}

specialDirectives["m-for"] = {
  beforeGenerate: function(prop, vnode, parentVNode, state) {
    // Setup Deep Flag to Flatten Array
    parentVNode.deep = true;
  },
  afterGenerate: function(prop, code, vnode, state) {
    // Get Parts
    const parts = prop.value.split(" in ");
    // Aliases
    const aliases = parts[0].split(",");
    // The Iteratable
    const iteratable = parts[1];
    compileTemplateExpression(iteratable, state.dependencies);

    // Get any parameters
    const params = aliases.join(",");

    // Add aliases to scope
    for(let i = 0; i < aliases.length; i++) {
      const aliasIndex = dependencies.indexOf(aliases[i]);
      if(aliasIndex !== -1) {
        dependencies.splice(aliasIndex, 1);
      }
    }

    // Use the renderLoop runtime helper
    return `Moon.renderLoop(${iteratable}, function(${params}) { return ${code}; })`;
  }
}

specialDirectives["m-on"] = {
  beforeGenerate: function(prop, vnode, parentVNode, state) {
    // Extract Event, Modifiers, and Parameters
    let value = prop.value;
    let meta = prop.meta;

    let methodToCall = value;

    let rawModifiers = meta.arg.split(".");
    const eventType = rawModifiers.shift();

    let params = "event";
    const rawParams = methodToCall.split("(");

    if(rawParams.length > 1) {
      // Custom parameters detected, update method to call, and generated parameter code
      methodToCall = rawParams.shift();
      params = rawParams.join("(").slice(0, -1);
      compileTemplateExpression(params, state.dependencies);
    }

    // Generate any modifiers
    let modifiers = "";
    for(let i = 0; i < rawModifiers.length; i++) {
      const eventModifierCode = eventModifiersCode[rawModifiers[i]];
      if(eventModifierCode === undefined) {
        modifiers += `if(Moon.renderEventModifier(event.keyCode, "${rawModifiers[i]}") === false) {return null;};`
      } else {
        modifiers += eventModifierCode;
      }
    }

    // Final event listener code
    const code = `function(event) {${modifiers}instance.callMethod("${methodToCall}", [${params}])}`;
    addEventListenerCodeToVNode(eventType, code, vnode);
  }
}

specialDirectives["m-model"] = {
  beforeGenerate: function(prop, vnode, parentVNode, state) {
    // Get attributes
    const value = prop.value;
    const attrs = vnode.props.attrs;

    // Add dependencies for the getter and setter
    compileTemplateExpression(value, state.dependencies);

    // Setup default event type, keypath to set, value of setter, DOM property to change, and value of DOM property
    let eventType = "input";
    let domGetter = "value";
    let domSetter = value;
    let keypathGetter = value;
    let keypathSetter = `event.target.${domGetter}`;

    // If input type is checkbox, listen on 'change' and change the 'checked' DOM property
    let type = attrs.type;
    if(type !== undefined) {
      type = type.value;
      let radio = false;
      if(type === "checkbox" || (type === "radio" && (radio = true))) {
        eventType = "change";
        domGetter = "checked";

        if(radio === true) {
          let valueAttr = attrs.value;
          const valueAttrValue = valueAttr === undefined ? "null" : `"${compileTemplate(valueAttr.value, delimiters, escapedDelimiters, dependencies, true)}"`;
          domSetter = `${domSetter} === ${valueAttrValue}`;
          keypathSetter = valueAttrValue;
        } else {
          keypathSetter = `event.target.${domGetter}`;
        }
      }
    }

    // Compute getter base if dynamic
    const bracketIndex = keypathGetter.indexOf("[");
    const dotIndex = keypathGetter.indexOf(".");
    let base = null;
    let dynamicPath = null;
    let dynamicIndex = -1;

    if(bracketIndex !== -1 || dotIndex !== -1) {
      // Dynamic keypath found,
      // Extract base and dynamic path
      if(bracketIndex === -1) {
        dynamicIndex = dotIndex;
      } else if(dotIndex === -1) {
        dynamicIndex = bracketIndex;
      } else if(bracketIndex < dotIndex) {
        dynamicIndex = bracketIndex;
      } else {
        dynamicIndex = dotIndex;
      }
      base = value.substring(0, dynamicIndex);
      dynamicPath = value.substring(dynamicIndex);

      // Replace string references with actual references
      keypathGetter = base + dynamicPath.replace(expressionRE, function(match, reference) {
        if(reference !== undefined) {
          return `" + ${reference} + "`;
        } else {
          return match;
        }
      });
    }

    // Generate the listener
    const code = `function(event) {instance.set("${keypathGetter}", ${keypathSetter})}`;

    // Push the listener to it's event listeners
    addEventListenerCodeToVNode(eventType, code, vnode);

    // Setup a query used to get the value, and set the corresponding dom property
    const dom = vnode.props.dom;
    if(dom === undefined) {
      vnode.props.dom = dom = {};
    }
    dom[domGetter] = domSetter;
  }
};

specialDirectives["m-literal"] = {
  duringPropGenerate: function(value, meta, vnode, dependencies) {
    const prop = meta.arg;
    compileTemplateExpression(value, dependencies);
    if(prop === "class") {
      // Detected class, use runtime class render helper
      return `"class": Moon.renderClass(${value}), `;
    } else {
      // Default literal attribute
      return `"${prop}": ${value}, `;
    }
  }
};

specialDirectives["m-html"] = {
  beforeGenerate: function(prop, vnode, parentVNode, state) {
    const dom = vnode.props.dom;
    if(dom === undefined) {
      vnode.props.dom = dom = {};
    }
    compileTemplateExpression(value, dependencies);
    dom.innerHTML = `("" + ${value})`;
  }
}

specialDirectives["m-mask"] = {

}

directives["m-show"] = function(el, val, vnode) {
  el.style.display = (val ? '' : 'none');
}
