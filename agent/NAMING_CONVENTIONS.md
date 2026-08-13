# NAMING_CONVENTIONS

- React component file / component: `PascalCase`．
- hook: `useXxx`．
- function / variable: `camelCase`．
- constant: project既存慣習を優先し，共有定数は意味が明確な名前にする．
- type / interface: `PascalCase`．
- test fileは対象に対応した既存の命名規則へ合わせる．
- 略語だけの名前や `data2`, `tmp`, `newFunc` のような曖昧名を避ける．
- 座標系・単位・左右を扱う値は，可能なら名前に意味を含める．例: `latitudeDeg`, `leftOarQuaternion`．
