# データ整合性の修正記録

## 2026-10-23：大会タグの欠落とプロフィール対応の保留

### PlayStation Typical Gamer Icon Cup

既存カタログの `ch7s3-playstation-typical-gamer-icon-cup-battle-royale` が参照する細分類を、`axes` の `subtype.options` に追加しました。IDと表示名は既存カタログに合わせています。大会分類自体を変更したり、他のIcon Cupにまとめたりしていません。

- ID：`playstation-typical-gamer-icon-cup-battle-royale`
- 表示名：PlayStation Typical Gamer Icon Cup Battle Royale
- 既存の出典：[Fortnite Trackerの大会ページ](https://fortnitetracker.com/events/epicgames_S41_PSTypicalGamer_NAW)

### chikoheni is bad のプロフィールリンク

対象戦績：`s41-me-aphrodite-fncs-cup-skin-20260801-chikoheni-gitsuko`

旧登録リンクは、Acris 0xに登録されたリンクと同じTrackerアカウントIDを含んでいました。確認時に両方のリンクがAcris 0xのプロフィールへ移動し、`chikoheni is bad` の名前のみでの照合は「404 Not Found」になりました。これだけでは過去の別名義か入力違いかを確定できません。

同一人物と推測して統合せず、chikoheni側の未確認リンクを `profiles` から外し、戦績の補足に保留理由を明記しました。掲載名・チーム・順位・PTS・キル・VR・賞金・大会出典は維持しています。Acris 0xの既存リンクと、相方die gitsukoのリンクは変更していません。

旧登録値（履歴保存用。本人対応は未確認）：

```text
https://fortnitetracker.com/profile/all/chikoheni%20is%20bad/events?id=5768dce9-d8d8-4c55-80e1-fb0ed49401d0
```

確認先：

- [現在Acris 0xとして表示されるプロフィール](https://fortnitetracker.com/profile/all/Acris%200x/events?id=5768dce9-d8d8-4c55-80e1-fb0ed49401d0)
- [chikoheni is badの名前での照合先](https://fortnitetracker.com/profile/all/chikoheni%20is%20bad/events)
- [戦績の大会出典](https://fortnitetracker.com/events/epicgames_S41_FNCSCommunityCup_ME)

正しいプロフィールURLまたは過去の別名義との対応を確認できた時点で、根拠を添えて再登録してください。検証の例外やIDの自動統合は追加していません。
