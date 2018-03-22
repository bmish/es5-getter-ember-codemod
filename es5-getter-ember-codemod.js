'use strict';

module.exports = function(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  function performReplacement(path, replacement) {
    if(path.node.arguments[0].value.indexOf('.') !== -1) {
      return;
    }

    path.replace(replacement);
  }

  function transformThisExpression() {
    return root
      .find(j.CallExpression, { callee: {
        object: {
          type: 'ThisExpression'
        },
        property: {
          name: 'get'
        }
      }})
      .forEach(path => {
        let replacement = j.memberExpression(
          j.thisExpression(),
          j.identifier(path.node.arguments[0].value)
        )

        performReplacement(path, replacement);
      });
  }

  function transformGetOnObject(typicalEmberAssignment) {
    typicalEmberAssignment = typicalEmberAssignment || 'model';

    return root
      .find(j.CallExpression, {
        callee: {
          object: {
            name: typicalEmberAssignment
          },
          property: {
            name: 'get'
          }
        }
      })
      .forEach(path => {
        let replacement = j.memberExpression(
          path.node.callee.object,
          j.identifier(path.node.arguments[0].value)
        )

        performReplacement(path, replacement);
      });
  }

  function transformGetPropertiesOnObject() {
    return root
      .find(j.CallExpression, {
        callee: {
          property: {
            name: 'getProperties'
          }
        }
      })
      .filter(path => {
        // check that this is part of a destructuring operation
        if (path.parentPath.node.type !== 'VariableDeclarator' || path.parentPath.node.id.type !== 'ObjectPattern') {
          return false;
        }

        // check that there are no "deep" paths (e.g. "foo.bar")
        return path.node.arguments.every(arg => arg.value.indexOf('.') === -1);
      })
      .forEach(path => {
        path.replace(
          path.node.callee.object
        )
      });
  }

  function transformStandaloneGet() {
    let hasGetImport = !!j(file.source).find(j.ImportDeclaration, {
      specifiers: [
        {
          local: {
            name: 'get'
          }
        }
      ],
      source: {
        value: '@ember/object'
      }
    }).length;

    if (!hasGetImport) { return; }

    return root
      .find(j.CallExpression, {
          callee: {
            name: 'get'
          },
          arguments: [
            j.thisExpression
          ]
        }
      )
      .forEach(function(path) {
        let replacement =  j.memberExpression(j.thisExpression(), j.identifier(path.node.arguments[1].value))

        let isNotThisExpression = path.node.arguments[0].type !== 'ThisExpression';
        let isNotDeeplyNested = path.node.arguments[1].value.indexOf('.') !== -1;

        if(isNotThisExpression || isNotDeeplyNested) {
          return;
        }

        path.replace(replacement);
      });
  }

  function transformEmberDotGet() {
    return root
      .find(j.CallExpression, {
        callee: {
          object: {
            name: 'Ember'
          },
          property: {
            name: 'get'
          }
        },
        arguments: [
          j.thisExpression
        ]
      })
      .forEach(function(path) {
        let replacement =  j.memberExpression(j.thisExpression(), j.identifier(path.node.arguments[1].value))

        let isNotThisExpression = path.node.arguments[0].type !== 'ThisExpression';
        let isNotDeeplyNested = path.node.arguments[1].value.indexOf('.') !== -1;

        if(isNotThisExpression || isNotDeeplyNested) {
          return;
        }

        path.replace(replacement);
      });
  }

  transformThisExpression();

  ['route', 'controller'].forEach(function(typicalEmberAssignment) {
    transformGetOnObject(typicalEmberAssignment);
  })

  transformGetPropertiesOnObject();

  transformStandaloneGet();

  transformEmberDotGet();

  return root.toSource();
}
