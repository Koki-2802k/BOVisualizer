# DEPENDENCY_RULES

- 新規packageは，既存dependencyまたはWeb標準APIで代替できないか先に確認する．
- dependency追加時は用途，license，maintenance状況，bundle size，browser compatibilityを確認する．
- React/Three/Leaflet/Recharts等のmajor upgradeを機能追加と同時に行わない．
- lockfileを意図せず大規模更新しない．
- CDNやremote scriptの追加を避け，npm dependencyとして追跡可能な形を優先する．
- 3D modelやsample data等の外部assetを追加する場合も，配布条件と出典を確認する．
