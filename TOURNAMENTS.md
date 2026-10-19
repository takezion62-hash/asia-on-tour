# 大会タグ検索・分類レポート

確認日：2026年10月20日。対象はチャプター7・シーズン4（出典シーズン識別子 `S42`）の既存136戦績・11大会です。

「大会を探す（TOURNAMENTS）」から形式別の大会一覧を開き、大会名を押すと地域・日付・ラウンドごとの選手戦績を確認できます。遠征結果と選手プロフィールの大会履歴にも同じタグを表示します。

## 分類の考え方

大会分類は、既存の戦績データとは別の `tournamentCatalog` に保存しています。大会シリーズ・ゲーム形式・大会細分類・チーム人数・機種条件の5項目を独立した軸として扱います。予選・Practice決勝・Performance決勝・賞金決勝・コスメ大会は、既存の `kind` に基づく別の絞り込みです。

- 登録済みの大会名、出典の大会識別子、公式大会ページ・公式規則を照合します。
- 形式や機種条件を確定できない項目は「未確認」にします。機種制限の記載がないことを、PC限定・制限なし・クロスプラットフォームの根拠にしません。
- 通常バトロワ、ゼロビルド、Reload、Reloadゼロビルドを区別します。Reload ZBを他の形式に含めません。
- FNCS Division 1 Practice、通常のFNCS Division 1、FNCS Major、FNCS Heats、FNCS LCQは別の大会細分類です。Performance EvaluationとChampion Focus FNCS CupもPracticeへ統合しません。
- 公式サイトの汎用「Battle Royale」欄は、既知のゼロビルド大会などにも表示されます。形式が曖昧な大会では、この欄だけで通常バトロワと断定しません。
- 分類の確認根拠とリンクは、大会詳細の「分類の確認根拠」からも開けます。

## タグ別の掲載戦績数

以下は絞り込みなしの件数です。デュオは既存データと同じくチーム単位で1戦績と数え、選手2名分として件数を倍にしません。各分類軸の合計は136件です。

### 大会シリーズ

|タグ|戦績数|
|---|---:|
|Victory Cup|118|
|Cash Cup|2|
|FNCS|7|
|Override Series|4|
|Performance Evaluation|2|
|Icon Cup|3|
|未確認|0|

### ゲーム形式

|タグ|戦績数|
|---|---:|
|通常バトロワ|33|
|ゼロビルド|42|
|Reload|55|
|Reloadゼロビルド|2|
|未確認|4|

### 大会細分類

|タグ|戦績数|
|---|---:|
|Solo Victory Cup|21|
|Reload Duos Victory Cup|7|
|Console Solo Victory Cup|42|
|Reload ZB Duos Cash Cup|2|
|Solo Reload Victory Cup|48|
|FNCS Division 1 Practice|6|
|Mega Man Cup|2|
|KINGDOM HEARTS Cup|2|
|Performance Evaluation|2|
|NickEh30 Icon Cup|3|
|Champion Focus FNCS Cup|1|
|FNCS Division 1|0|
|FNCS Major|0|
|FNCS Heats|0|
|FNCS LCQ|0|
|未確認|0|

0件のFNCS区分は将来の追加に備えた独立した選択肢です。未掲載の戦績を作成したり、Practiceの6件を他の区分へ配分したりしていません。

### チーム人数

|タグ|戦績数|
|---|---:|
|ソロ|117|
|デュオ|19|
|未確認|0|

### 機種条件

|タグ|戦績数|
|---|---:|
|クロスプラットフォーム|82|
|コンソール|42|
|PlayStation|3|
|未確認|9|

「クロスプラットフォーム」は公式規則で確認できた大会に限定しています。「コンソール」「PlayStation」について、確認できない機種世代などは追加していません。

画面のタグ件数は、ほかの絞り込み条件に一致する戦績数です。同じ軸の別タグへ切り替えた場合の件数を示すため、その軸自身の選択条件だけを除いて集計します。

## 分類に未確認項目が残る大会

|登録済み大会名|戦績数|未確認の項目|
|---|---:|---|
|Reload ZB Duos Cash Cup|2|機種条件|
|Override Series: Mega Man Cup|2|ゲーム形式・機種条件|
|Override Series: KINGDOM HEARTS Cup|2|ゲーム形式・機種条件|
|Fortnite Performance Evaluation|2|機種条件|
|Champion Focus FNCS Cup|1|機種条件|

Mega Man CupとKINGDOM HEARTS Cupの公式規則は通常バトロワ版・ゼロビルド版の両方を扱っています。登録名には形式がなく、今回確認した資料だけでは当該戦績の形式を十分に確定できないため、計4戦績を「未確認」にしています。チーム人数は、それぞれ公式ページ・規則でデュオ／ソロを確認しています。

PlayStation NickEh30 Icon Cupは、既存出典の `S42_PSNickEh30_Qualifier_NAW` と公式日程の通常バトロワ版を照合しています。ゼロビルド版の別識別子 `S42_PSNickEh30_ZB` とは区別します。Champion Focus FNCS Cupは、既存ラウンド名に明記された「Battle Royale」も分類根拠にしています。

## 主な確認元

|対象|公式確認元と確認内容|
|---|---|
|Solo Victory Cup・Solo Reload Victory Cup・Reload Duos Victory Cup・Console Zero Build Solo Victory Cup|[Victory Cups公式規則](https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules)の2.2.1〜2.2.4で形式・人数、2.2.6でクロスプラットフォームを確認。コンソール大会の条件は明示された大会名も使用。|
|Reload ZB Duos Cash Cup|[公式大会ページ](https://www.fortnite.com/competitive/events/S42_ReloadCashCup_DuosZB/)と[Zero Build Reload Cash Cups公式規則](https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-zero-build-reload-cash-cups-chapter-7-season-4-official-rules)でReloadゼロビルド・デュオを確認。|
|FNCS Division 1 Practice|[公式大会ページ](https://www.fortnite.com/competitive/events/S42_FNCSDivisionalCup_Division1/)がPracticeと明示。[Practice Cups公式規則](https://www.fortnite.com/competitive/rules-guidelines/rules-library/fncs-practice-cups-chapter-7-season-4-official-rules)の2.2で通常バトロワ・デュオ、2.2.10でクロスプラットフォームを確認。|
|Override Series: Mega Man Cup|[公式大会ページ](https://www.fortnite.com/competitive/events/S42_MegaManCup/)と[公式規則](https://www.fortnite.com/competitive/rules-guidelines/rules-library/override-series-mega-man-cup-chapter-7-season-4-official-rules)。デュオとシリーズを確認し、形式・機種条件は未確認を維持。|
|Override Series: KINGDOM HEARTS Cup|[公式大会ページ](https://www.fortnite.com/competitive/events/S42_KingdomHeartsCup/?region=ME)と[公式規則](https://www.fortnite.com/competitive/rules-guidelines/rules-library/override-series-kingdom-hearts-cup-chapter-7-season-4-official-rules)。ソロとシリーズを確認し、形式・機種条件は未確認を維持。|
|Fortnite Performance Evaluation|[当該S42公式大会ページ](https://www.fortnite.com/competitive/events/S42_PerformanceEvaluation/?region=NAC)で通常バトロワ・デュオと性能検証イベントであることを確認。FNCS参加条件をPracticeという分類の根拠にはしない。|
|PlayStation NickEh30 Icon Cup|[当該予選を含む公式大会情報](https://www.fortnite.com/competitive/events/S42_PSNickEh30?region=NAC&round=S42_PSNickEh30_Qualifier_NAW)と[公式規則](https://www.fortnite.com/competitive/rules-guidelines/rules-library/playstation-nick-eh-30-cup)で、モード別開催・ソロを確認。PlayStationは明示された大会名を使用。|
|Champion Focus FNCS Cup|[公式大会ページ](https://www.fortnite.com/competitive/events/S42_ChampionFocusFNCSCup/)と[公式規則](https://www.fortnite.com/competitive/rules-guidelines/rules-library/champion-focus-fncs-cup-chapter-7-season-4-official-rules)でソロ・コスメ大会を確認。既存ラウンド表記を併用し、PracticeやFNCS本戦とは別区分にする。|

元の大会順位・ポイント・賞金を再取得して置き換える作業は行っていません。上記の追加確認は大会分類の根拠に使用しています。

## 過去シーズン追加時の識別・開催枠

大会カタログは `id`・`chapter`・`season`・`seasonId`・`sourceEventIds` を持ちます。現在の例は `id: ch7s4-solo-reload-victory-cup`、`chapter: 7`、`season: 4`、`seasonId: S42` です。表示名が同じ大会でも、別シーズンのカタログと根拠を追加して扱えます。

分類には出典シーズン、登録済み大会名の完全一致、確認済み出典大会IDの一致を必要とします。出典はFortnite公式・Fortnite Trackerのホストに限定し、大会IDとラウンドIDに異なるシーズンが記載されている場合も確認済み分類へ結び付けません。未登録シーズン・不一致の大会は各項目を「未確認」とし、既存S42の分類を継承させません。

出典の `window` または `round` をラウンドIDとして保持します。開催枠は大会IDに加えて、既存の地域・日付・ラウンド表記・大会区分・出典ラウンドIDで分けます。ラウンドIDがない場合は、明示されたEvent／Week／Session番号を含む既存ラベルを使用します。いずれも確認できない場合は戦績IDで個別表示し、同じ日付というだけで別の開催枠を統合しません。未確認のEvent番号やRound番号を日付から補完することもありません。

出典URLの `region=NAC` とラウンドID末尾の地域が異なる既存記録について、地域をURLの汎用クエリから上書きしません。登録済みの地域を表示し、出典リンクを保持します。

共有URLは検索条件用の `#tournaments?mode=reload-zero-build`、大会詳細用の `#tournament=ch7s4-solo-reload-victory-cup` を使用します。直接URLを開いても表示でき、ブラウザの戻る操作と画面内の戻る操作に対応します。

## データ保全の確認

|確認項目|変更前|変更後|
|---|---:|---:|
|掲載戦績数|136件|136件|
|戦績中の掲載選手数|86名|86名|
|確認済み個人賞金合計|$9,000|$9,000|
|Shirokaの確認済み個人賞金|$400|$400|
|miruの確認済み個人賞金|$700|$700|
|でーもんくらげǃの確認済み個人賞金|$600|$600|

既存の戦績・選手配列、賞金計算・ランキング計算を保持しています。デュオ賞金は確認済みの個人配分だけを個人賞金へ加算し、予選のVRやコスメ報酬を現金賞金へ換算しません。大会詳細の戦績では、既存のチーム賞金・各選手配分の区別も維持します。

選手プロフィール、賞金ランキング、地域配色、遠征結果の検索・フィルター・並び替え・賞金獲得のみ表示・CSV出力・出典リンクを保持し、一般閲覧者向けの登録フォームは追加していません。大会画面の人数は「掲載選手」と表示し、相方の活動地域が未確認の場合にASIA選手と断定しません。
