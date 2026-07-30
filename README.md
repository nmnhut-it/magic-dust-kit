# Magic Dust — Bộ Đồ Nghề

**Chơi ngay, không cài gì: <https://magic-dust-project.nmnhut.dev>**

Bạn vừa bước qua Gương Vô Cực. Đây là xưởng của bạn: mã nguồn của chính đồ chơi
bạn vừa chơi. **Bạn viết Python, và Python của bạn điều khiển camera thật.**

Trong này có ba trang:

| | |
|---|---|
| `index.html` (trang chủ) | **Trang làm bài — vào đây trước.** Chín ô kiểu sổ tay: gõ Python, bấm CHẠY, máy chấm ngay và dựng ẢNH VÀO / ẢNH RA bằng chính code bạn vừa viết. Xong năm ô bắt buộc thì cổng sang sân khấu mở. Cuối trang có BẢNG ĐIỂM trên 10 để chụp màn hình gửi bố mẹ |
| `san-khau.html` | **Sân khấu thật** — camera bật lên, tay bạn hiện trong khung, và mã Python bạn vừa viết quyết định phép nào hiện ra |
| `lessons/islandFXFORGE.html` | **Đảo GƯƠNG VÔ CỰC** — nơi bạn học lật ảnh, ghép lớp, chỉnh sáng trên lưới số nhỏ |

**Không cài Python cũng học được.** Python chạy sẵn trong trình duyệt (Pyodide),
bài lưu trong `localStorage` của chính máy bạn. Mở trang chủ, làm, rồi bấm nút
ra sân khấu — code đi theo. Ai muốn sửa file trên đĩa như thợ thật thì vẫn sửa
`student/*.py` được, hai đường dùng chung một bộ chấm.

---

## Chạy nó lên

**Windows: bấm đúp vào `CHAY.bat`.** Hết. Máy chưa có Python thì nó tự cài
giúp, rồi mở trình duyệt luôn.

Máy Mac hoặc Linux, hoặc bạn thích gõ lệnh:

```bash
python serve.py
```

Rồi mở:

- làm bài → <http://localhost:8123/>
- sân khấu → <http://localhost:8123/san-khau.html>
- đảo gương → <http://localhost:8123/lessons/islandFXFORGE.html>

Dùng **Chrome** hoặc **Edge** nhé.

> **Đừng nhấp đúp vào file `.html`.** Mở kiểu `file://` thì trình duyệt không
> cho dùng camera. Cũng đừng dùng Live Server của VS Code — đảo gương cần hai
> dòng tiêu đề đặc biệt mà chỉ `serve.py` gửi kèm.

Lần đầu mở, trang phải tải Python về máy nên hơi lâu. Xong sẽ hiện
`Python sẵn sàng` ở góc phải.

**Nghi trang đang chạy bản cũ?** Bấm nút **⟳ LẤY BẢN MỚI** ở đầu trang: nó xoá
bản cũ trong máy rồi tải lại. Thường thì khỏi cần — trang tự so số bản dựng với
máy chủ mỗi lần mở, thấy lệch là tự nạp lại (đúng một lần, không quay vòng).

---

# BÀI CỦA BẠN

Chín hàm, chia làm hai nhóm. Có hai cách làm, chọn cách nào cũng được:

**Cách 1 — ngay trên trang chủ (khuyên dùng).** Mỗi hàm một ô riêng, có tô
màu code, có nút CHẠY & CHẤM. Chạy xong máy nói ngay đúng hay sai và vẽ luôn
ảnh mà code bạn dựng ra — sai thì sửa rồi chạy lại. Không cần cài gì, không
cần biết thư mục nằm ở đâu.

**Cách 2 — sửa file `student/*.py` bằng trình soạn thảo.** Lưu file rồi quay ra
trang bấm phím `R`. Hợp với ai đã quen dùng VS Code.

Bài làm ở cách 1 được ưu tiên: khi trong máy đã có bài bạn gõ trên trang, sân
khấu chạy bài đó chứ không đọc file trên đĩa nữa.

**Điểm.** Mỗi bài bắt buộc 1,4 điểm (5 bài = 7,0), mỗi bài thêm 0,75 (4 bài =
3,0) — vừa tròn 10. Bảng điểm nằm cuối trang, có ô điền tên và ngày tháng, tự
cập nhật mỗi lần bạn chạy một ô. Ô nào đã xanh thì hôm sau mở lại vẫn xanh.
Máy chấm bằng cách CHẠY THẬT code của bạn trên mấy ảnh mẫu, không phải so chữ.

## Nhóm 1 — chọn phép bằng tay và bằng giọng nói (`spells.py`)

Hai hàm, cả hai đều là bài `if / elif / else`. Máy đã viết sẵn khung, việc của
bạn là điền phần trong ruột.

```python
def on_fingers(count):    # máy đếm số ngón tay bạn giơ lên rồi gọi hàm này
    ...

def on_voice(word):       # micro nghe được một từ thì gọi hàm này
    ...
```

**Đề bài đang có trong file:**

| Bạn làm gì | Phải ra phép gì |
|---|---|
| giơ 1 ngón | `dragon` |
| giơ 2 ngón | `phoenix` |
| giơ 3 ngón | `sakura` |
| số khác | nói ra "chưa gán phép cho số này" |
| 1 ngón **và** nói "rồng"/"dragon" | `dragon` |
| 2 ngón **và** nói "phượng"/"phoenix" | `phoenix` |
| 3 ngón **và** nói "hoa"/"sakura" | `sakura` |
| đúng lời nhưng sai tay | không ra phép, `say(...)` nhắc thiếu gì |

Nói suông không ra phép — phải bắt đúng thế tay rồi mới niệm. Đó là chỗ học
`and`: cả hai vế đúng thì cả điều kiện mới đúng.

Trong hàm bạn gọi `play_effect("dragon")` để mở một lớp hiệu ứng, `say("...")`
để hiện chữ, và `fingers_now()` để hỏi đang giơ mấy ngón.

**Sân khấu cố ý để trống — không còn phím tắt hay từ khoá nào tự bắn ra
rồng/phượng/hoa/mưa cả.** Trước đây bốn hiệu ứng này còn có phím D/5/7/3 và
giọng nói demo sẵn, bấm/nói là ra dù bạn chưa viết code — vậy nên gỡ hết:
bốn cái tên đó giờ CHỈ là tên hiệu ứng (`play_effect("dragon")`,
`play_effect("phoenix")`,...), muốn thấy chúng thì phải tự viết đúng
`on_fingers`/`on_voice` (hoặc `main_loop`, xem bên dưới). Gắn nút bằng
`setup()`, bỏ video của mình vào cũng vậy — tất cả là của bạn. Mấy hiệu ứng
khác (`koto`, `rose`, `butterfly`, `smoke`, `flower`, `magic`) vẫn gọi được
bằng `play_effect("tên")`, chỉ là không bày sẵn ra bảng.

Bài này không cần ai chấm: giơ tay lên camera là thấy ngay mình đúng hay sai.

## Nhóm 2 — ba phép xử lý ảnh (`image_spells.py`)

Ở đảo gương bạn viết `flip` và `blend` trên lưới số nhỏ. Ở đây **vẫn đúng phép
tính đó và vẫn đúng cách viết đó** — ảnh là mảng ba chiều:

```python
image[row][col]      # -> [đỏ, xanh lá, xanh dương], mỗi số 0..255
image[row][col][0]   # riêng màu đỏ của ô đó
```

Khác mỗi chỗ: máy gọi hàm của bạn hàng chục lần mỗi giây trên hình từ camera.

| Hàm | Việc của nó | Phím thử |
|---|---|---|
| `flip` | soi gương trái–phải | `F` |
| `blur` | mỗi ô lấy màu trung bình với hàng xóm | `B` |
| `blend` | cộng ánh sáng — cho lửa, sét, hào quang | `N` |
| `blend_alpha` | pha đều theo tỉ lệ | `Y` |
| `blend_over` | ghép chuẩn theo kênh alpha từng ô | `J` |
| `compose` | tách người khỏi phòng rồi dán lên nền khác | `O` |
| `blur_background` | nền mờ, người vẫn nét (kiểu họp trực tuyến) | `Z` |
| `scene` | cả cảnh phim: nền video · lớp sau · người · hiệu ứng trước | `S` |

**Bấm `T` trước khi hỏi ai** — máy dựng một ảnh tí hon rồi chỉ đúng chỗ bạn
sai, kiểu `✖ blur: ô góc vẫn đen — ánh sáng chưa lan sang hàng xóm`.

Chưa viết gì mà bấm `F` thì ô xem thử hiện đúng ảnh camera y như cũ. Máy sẽ
nói thẳng `flip() chưa đổi gì trên ảnh` chứ không để bạn ngồi đoán là máy hỏng.

> Yên tâm: phép video (`play_effect`) KHÔNG cần `blend`. Lớp hiệu ứng đó do
> trang web tự ghép, nên bài 1 chạy được ngay cả khi bài 2 còn dang dở. `blend`
> của bạn chỉ điều khiển ô xem thử khi bấm `N` — đó là chỗ bạn tự tay làm lại
> việc mà trang web vẫn làm hộ.

## Bài thêm — bốn phép nữa, làm được thì làm

Nằm ngay dưới `blend` trong cùng file, cả bốn đều ngắn hơn `blur`:

| Hàm | Việc của nó | Phím thử |
|---|---|---|
| `negative` | âm bản: mỗi kênh lấy `255 -` giá trị cũ | `A` |
| `grayscale` | đen trắng: ba kênh cùng bằng trung bình cộng | `W` |
| `flip_vertical` | lộn đầu xuống chân | `V` |
| `drop_blue` | tắt hẳn kênh xanh dương | `C` |

## Mấy phím cần nhớ

| Phím | Việc |
|---|---|
| `R` | nạp lại `student/*.py` sau khi bạn sửa |
| `T` | máy tự chấm mọi hàm xử lý ảnh và nói bạn sai ở đâu |
| `F` `B` `N` | chạy `flip` / `blur` / `blend` của bạn trên hình camera |
| `O` | ghép nền: đứng trước cổng Kotopia thay vì bức tường lớp |
| `Z` | làm mờ nền, giữ mình nét |
| `S` | cả cảnh phim, nền là video khu rừng |
| `A` `W` `V` `C` | bốn bài thêm |
| `M` | bật/đổi kiểu tách nền — bấm trước khi dùng `O` |
| `X` | tắt phép xử lý ảnh |

## Đi từng bậc, tới cảnh phim hoàn chỉnh

Sáu bài ảnh bắt buộc là một bậc thang, bài sau dùng lại hàm của bài trước:

| Bậc | Học được gì |
|---|---|
| `flip` | ảnh là bảng ô, đổi chỗ ô là đổi ảnh |
| `blur` | trộn một ô với hàng xóm |
| `compose` | **tách nền** — mặt nạ nói ô nào là người |
| `blend` | **cộng ánh sáng** — đúng cho lửa, sét, hào quang |
| `blend_alpha` | pha theo tỉ lệ, cả tấm cùng một độ mờ |
| `blend_over` | **kênh alpha** — độ đục riêng cho từng ô, phép ghép chuẩn |
| `blur_background` | gọi lại `blur` + `compose`: nền mờ, người nét |
| `scene` | gọi lại `blend` + `compose`: **nền video · lớp sau · người · hiệu ứng trước** |

Tới `scene` là các em dựng được đúng cái mà phần mềm dựng phim làm: bốn lớp
xếp đúng thứ tự, chạy trên video thật ở 96×72, mỗi giây vài chục khung.

## Ba lớp: nền, người, hiệu ứng

`compose` là bài đáng khoe nhất. Máy đưa cho bạn ba thứ: ảnh người, ảnh nền, và
một tấm **mặt nạ** — `mask[row][col]` là MỘT số 0..255 nói ô đó chắc là người
tới đâu. Việc của bạn là hỏi từng ô một câu và lấy màu từ đúng tấm:

```python
if mask[row][col] > 128:
    out[row][col] = person[row][col]
else:
    out[row][col] = background[row][col]
```

Đúng `if / else` của bài chọn phép, lần này chạy trên từng điểm ảnh. Ở sân
khấu, mặt nạ đó là **của chính bạn**, do MediaPipe cắt ra từ camera: bấm `M`
để bật tách nền rồi bấm `O`.

Ghép tiếp `blend` nữa là đủ ba lớp — nền, người, rồi hiệu ứng phủ lên trước.
Ở trang làm bài có **XƯỞNG THỬ** cuối trang: bấm `compose` rồi `blend`, máy
chạy nối tiếp hai hàm của bạn trên cùng một tấm ảnh.

## Kênh alpha và ba kiểu ghép

Mỗi ô ảnh thật ra có **bốn** số: đỏ, xanh lá, xanh dương, và **alpha** — độ
đục. 255 là đục kín, 0 là trong suốt, ở giữa là mờ. Ảnh PNG nền trong suốt sống
được là nhờ số thứ tư đó.

Phép ghép chuẩn (sách nào cũng gọi là "A đè lên B"):

```python
(trên * alpha + dưới * (255 - alpha)) // 255
```

Ba bài trong bộ này là ba nấc của đúng công thức đó:

| Bài | Alpha ra sao | Kết quả |
|---|---|---|
| `compose` | chỉ 0 hoặc 255 | cắt cứng, rìa răng cưa |
| `blend_alpha` | một số duy nhất cho cả tấm | cả ảnh mờ đều |
| `blend_over` | riêng cho từng ô | rìa mượt — bản đầy đủ |

`blend` (cộng) không nằm trong mạch này: nó dành cho ánh sáng, thứ làm sáng
thêm chứ không che mất phía sau. Hai kiểu ghép ấy khác nhau về bản chất, và đó
là lý do có cả hai bài.

## Bảng nút của riêng bạn

Hàm `setup()` chạy một lần lúc máy nạp mã. Trong đó gọi `add_button` bao nhiêu
lần tuỳ thích:

```python
def setup():
    add_button("Rồng Lửa", "dragon")
    add_button("Mưa Giông", "rain")
```

Mỗi lời gọi mọc một nút thật ở góc phải sân khấu. Cạnh đó có ô gõ từ để thử
`on_voice()` khi máy không có micro — gõ "mưa" rồi Enter là thấy hàm mình chạy.

`add_button` không chỉ nhận TÊN hiệu ứng có sẵn — vế thứ hai còn nhận thẳng
một HÀM Python của chính bạn. Bấm nút là chạy đúng hàm đó, không đi qua
`play_effect` mặc định nữa, nên nút có thể làm bất cứ gì mã Python cho phép:
gọi liền mấy hiệu ứng, in ra một câu, hay bất cứ logic nào bạn viết.

```python
def combo():
    play_effect("dragon")
    play_effect("phoenix")
    say("hai phép cùng lúc!")

def setup():
    add_button("Rồng Lửa", "dragon")     # nhãn + tên hiệu ứng có sẵn
    add_button("Combo", combo)           # nhãn + hàm của riêng bạn
```

## `stage` — bài cuối cùng, tự dựng sân khấu của mình

Không có đáp án đúng. `stage()` chạy đúng một lần lúc sân khấu mở, và mọi thứ
trong đó là quyết định của bạn:

```python
def stage():
    set_background("rung")        # nền phía sau bạn: rung · cong_kotopia · hai_dang
    set_behind("rain")            # hiệu ứng bay SAU LƯNG bạn
    set_front("dragon")           # hiệu ứng phủ TRƯỚC MẶT bạn
    add_button("Rồng Lửa", "dragon")
    add_button("Mưa Giông", "rain")
```

Đề bài chỉ đòi ít nhất một nền và một nút — làm được bấy nhiêu là qua bài.
Ba lớp `background`/`behind`/`front` xếp chồng đúng thứ tự các em đã tự tay
dựng ở bài `scene`; lần này máy lo phần lắp ráp, các em ra quyết định. Và nó
**là thật**: mở `san-khau.html` lên, `stage()` của bạn tự chạy ngay — nền,
hai lớp hiệu ứng, và bảng nút hiện đúng như những gì bạn vừa viết, không phải
một bản xem trước giả.

`set_background`/`set_behind`/`set_front` không chỉ nhận tên có sẵn
(`rung`/`cong_kotopia`/`hai_dang` cho nền; `dragon`/`phoenix`/`sakura`/`rain`
và mấy hiệu ứng video khác cho lớp trước/sau) — chúng còn nhận đúng cái tên bạn
vừa đặt cho video của mình ở
khung **"+ HIỆU ỨNG CỦA BẠN"**. Tải một clip `.mp4` quay trên nền đen lên,
đặt tên `rong_tu_ve` chẳng hạn, rồi gọi thẳng `set_front("rong_tu_ve")` —
video của chính bạn giờ là lớp phủ trước mặt, y hệt cách `play_effect()` đã
dùng cái tên đó. `add_button` trong `stage()` cũng nhận hàm riêng như ở trên —
ví dụ một nút gọi `combo()` để bắn liền hai hiệu ứng.

## `main_loop` — bài thêm, tự viết vòng lặp chính đọc cảm biến

Từ đầu tới giờ, MÁY là bên gọi `on_fingers`/`on_voice` hộ bạn — đúng lúc ngón
tay đổi, đúng lúc micro nghe được gì, máy tự gọi đúng hàm của bạn. Bài này đảo
ngược lại: BẠN tự viết một vòng lặp đi HỎI máy, đúng cấu trúc một chương trình
thật (đọc cảm biến → quyết định → lặp lại), thay vì chỉ điền nội dung một hàm
máy gọi sẵn.

```python
async def main_loop():
    while True:
        count = fingers_now()      # số ngón tay NGAY LÚC NÀY
        word = heard_word()        # từ vừa nghe được, rỗng nếu chưa ai nói gì mới
        if count == 1 and word in ("rồng", "dragon"):
            play_effect("dragon")
        # ... rẽ nhánh tuỳ bạn
        await asyncio.sleep(0.15)   # BẮT BUỘC

run_loop(main_loop)
```

**`await asyncio.sleep(...)` ở cuối mỗi vòng KHÔNG được thiếu.** Trình duyệt
chạy Python thẳng trên luồng chính — không có luồng phụ nào khác vẽ hình, xử
lý chuột, hay đọc camera. `await` là chỗ Python nhường lại một nhịp cho trình
duyệt rồi mới tiếp tục; `while True` mà không có dòng đó thì không bao giờ
nhường ai cả, và cả trang đứng hình. Bài chấm biết chuyện này: thiếu `while`
thật hoặc thiếu `await asyncio.sleep(...)` là rớt ngay, không cần chạy thử.

`heard_word()` đọc xong tự xoá (đọc lại ngay sau đó ra chuỗi rỗng), để một
câu nói không lặp lại mãi trong vòng lặp poll — muốn phản ứng lại đúng một lần
thì gọi nó đúng một lần mỗi vòng, cất vào biến rồi dùng lại biến đó.

Việc khó — nhận diện tay, nhận diện người, ghép lớp cảnh — máy đã giấu sau
`fingers_now()`/`heard_word()`/`play_effect()`/`set_background()` từ trước;
bài này chỉ đòi bạn tự viết phần vòng lặp gọi đúng chúng, y hệt cách một app
thật (đọc input → xử lý → gọi hành động) được dựng, chỉ có phần khó đã trừu
tượng hoá sẵn để bạn được "nếm" cả pipeline mà không phải viết từ số 0.

## Máy chấm giúp ngay lúc bật máy chủ

Mỗi lần chạy `CHAY.bat` (hoặc `python serve.py`), cửa sổ đen in ra bảng chấm
trước khi mở trang — bạn biết mình còn thiếu gì mà chưa cần bấm phím nào:

```
Bai trong student/ :
  ✓ flip
  ✖ blur: ô góc vẫn đen — ánh sáng chưa lan sang hàng xóm
  ...
  => con 1 cho chua xong.
```

Muốn chấm lại mà không tắt máy chủ thì mở cửa sổ khác gõ `python cham.py`, hoặc
bấm `T` ngay trong trang.

---

# THÊM PHÉP CỦA RIÊNG BẠN

Ba mức, từ dễ tới đáng khoe.

## Mức 1 — gán thêm một hiệu ứng có sẵn

Bộ này có sẵn 11 hiệu ứng mà đề bài mới dùng có ba. Thêm một nhánh `elif`, đặt
**trước** `else`, là xong:

```python
    elif count == 4:
        play_effect("butterfly")
```

`else` phải nằm cuối cùng, vì nó là nhánh "không khớp cái nào ở trên". Đặt nó
lên trước thì mấy `elif` phía sau không bao giờ tới lượt.

## Mức 2 — video hiệu ứng của riêng bạn

**Cách nhanh (không cần chép file vào đâu cả).** Ở sân khấu, bấm nút
**＋ HIỆU ỨNG CỦA BẠN** góc dưới bên trái: đặt tên, chọn file video, xong. Trang
tự cất clip vào kho riêng của trình duyệt (IndexedDB — `localStorage` quá nhỏ
cho video), nên tắt máy mở lại vẫn còn, và nó hiện luôn dòng lệnh để bạn chép:

```python
play_effect("rong_lua")
```

Tên có dấu hoặc có khoảng trắng sẽ được đổi thành chữ thường không dấu, vì đó
là tên bạn gõ trong Python. "Rồng Lửa của Bảo" thành `rong_lua_cua_bao`.

Cái tên đó dùng được ở CẢ bài `stage` — `set_background`/`set_behind`/
`set_front` nhận đúng tên bạn vừa đặt, không chỉ mấy tên có sẵn trong đề.

**Cách của thợ (máy nhà, sửa file thoải mái).** Bỏ video vào `assets/my-fx/` rồi
khai một dòng trong `src/my-spells.js`:

```js
export const MY_FX = {
  ronglua: { n: 'Rồng Lửa', file: './assets/my-fx/rong-lua.mp4', hotkey: 'v' },
};
```

`ronglua` là tên bạn gọi từ Python · `n` là tên hiện trên bảng thần chú ·
`hotkey` là phím bấm thử cho nhanh (chọn phím chưa ai dùng).

Cách nào cũng gọi giống nhau từ `student/spells.py`:

```python
    if count == 1:
        play_effect("ronglua")
```

Lưu, bấm `R`, giơ tay lên.

**Vì sao bắt buộc nền đen?** Vì `blend` **cộng ánh sáng** chứ không dán đè:
`out[i] = min(255, px[i] + layer[i])`. Ô nào của video màu đen thì giá trị gần
`0`, cộng vào khung hình gần như không đổi gì — nền tự biến mất, khỏi cần cắt,
khỏi cần phông xanh. Ngược lại, video có nền xám hay có bầu trời sẽ làm cả
khung hình sáng trắng lên. Đó không phải máy hỏng, đó là phép cộng đang làm
đúng việc của nó.

**Tự tạo video bằng Gemini:** xem [`TAO-VIDEO-HIEU-UNG.md`](TAO-VIDEO-HIEU-UNG.md)
— có sáu prompt mẫu viết sẵn (rồng lửa, vòng phép, cánh hoa, sét, bụi sao,
bươm bướm) và cách kiểm xem nền đã đủ đen chưa.

## Mức 3 — phép xử lý ảnh của riêng bạn

Bốn bài thêm ở trên (`negative`, `grayscale`, `flip_vertical`, `drop_blue`) là
để bạn quen tay. Xong rồi thì tự nghĩ phép thứ năm — chúng chỉ là hàm Python
bình thường chạy trên một danh sách số:

- **Nửa ảnh soi gương:** chỉ lật cột bên trái, giữ nguyên bên phải.
- **Tăng tương phản:** ô nào sáng hơn 128 thì đẩy lên 255, còn lại kéo về 0.
- **Đổi chỗ hai kênh màu:** ghi đỏ vào chỗ xanh dương và ngược lại.
- **Mờ mạnh hơn:** đổi `blur` từ 3×3 sang 5×5, và để ý máy chậm đi bao nhiêu —
  đó chính là lý do bộ này chạy ảnh ở 96×72.

Muốn máy chấm giúp phép mới thì tự viết thêm vài dòng kiểm trong `check_all()`,
đúng kiểu mấy dòng đã có sẵn.

---

# BÊN DƯỚI NÓ CHẠY THẾ NÀO

Không có gì thần bí, và biết chỗ này thì lúc hỏng bạn tự sửa được.

**Python thật chạy trong trình duyệt.** Trang nạp **Pyodide** — bản Python được
biên dịch sang WebAssembly để chạy được trong tab web. Vì vậy lần đầu mở hơi
lâu (phải tải Python về), và vì vậy bạn viết Python thật chứ không phải một thứ
na ná.

**Máy đọc file của bạn bằng `fetch`.** `src/py-runtime.js` tải
`student/spells.py` và `student/image_spells.py` về rồi cho Pyodide chạy. Bấm
`R` là nó tải lại — kèm `?t=` phía sau đường dẫn để trình duyệt đừng đưa bản
cũ trong bộ nhớ đệm. Đây là lý do phải mở qua `localhost`: `fetch` không đọc
được file kiểu `file://`.

**`magic_stage` là cầu nối.** Máy đăng ký một module Python tên `magic_stage`
chứa `play_effect` và `say`; hai lệnh đó gọi ngược ra JavaScript để bật video
và hiện chữ. Nên `from magic_stage import play_effect, say` không tìm thấy gì
trên mạng cả — nó do chính trang này dựng ra.

**Ai gọi hàm của bạn:**

| Việc xảy ra | Máy gọi |
|---|---|
| MediaPipe nhìn thấy số ngón tay đổi | `on_fingers(count)` |
| Micro nghe ra một từ | `on_voice(word)` |
| Mỗi khung hình, khi đang bật `F`/`B`/`N`/`A`/`W`/`V`/`C` | hàm xử lý ảnh tương ứng |
| Bạn bấm `T`, và `serve.py` lúc khởi động | `check_all()` |

Nếu bạn đổi tên hàm hoặc chưa lưu file, máy sẽ nói thẳng
`Chưa thấy hàm on_fingers()`.

**Ảnh tới tay bạn dưới dạng gì.** Máy vẽ khung hình camera xuống một canvas
**96×72** rồi đưa cho bạn danh sách số `px`. Mỗi ô ảnh chiếm 4 số liền nhau —
đỏ, xanh lá, xanh dương, độ đục — nên ô ở hàng `row` cột `col` bắt đầu tại
`(row * width + col) * 4`. Bạn đọc `px`, ghi vào `out`.

**Vì sao bé thế?** Vì Python thuần (không numpy) chạy ở luồng chính, đo bằng
chính máy này:

| cỡ ảnh | `flip` | `blur` |
|---|---|---|
| 64×48 | 250 hình/giây | 47 |
| **96×72** | **159** | **22** |
| 320×240 | 11 | 2 |

96×72 là chỗ `blur` — hàm nặng nhất — vẫn còn mượt. Muốn nét hơn thì đổi `W`,
`H` trong `src/py-runtime.js`, nhưng hình sẽ khựng. Vì lý do đó phần ảnh còn
chạy cách khung (`FRAME_EVERY = 2`, xử lý một trong hai khung).

**Phần còn lại là gì:** `src/main.js` lo camera, MediaPipe (thư viện nhận dạng
bàn tay), và Three.js (bụi phép 3D). `src/spells.js` giữ bảng hiệu ứng có sẵn
và trộn thêm `MY_FX` của bạn vào. `serve.py` là máy chủ tí hon, tồn tại chỉ để
gửi kèm hai dòng tiêu đề `COOP`/`COEP` mà đảo gương cần.

---

## Khi có gì đó hỏng

- **Góc màn hình hiện `✖ SyntaxError: ... (line 48)`** → mã Python của bạn sai
  cú pháp ở đúng dòng đó. Sửa, lưu, bấm `R`.
- **`Chưa thấy hàm on_fingers()`** → bạn đổi tên hàm, hoặc chưa lưu file.
- **Sửa rồi mà màn hình không đổi** → quên bấm `R`. Bấm xong phải thấy dòng
  `Đã nạp lại student/*.py`.
- **Không thấy tay** → phải mở qua `localhost` chứ không phải `file://`, và cho
  phép trình duyệt dùng camera. Ngồi cách camera một sải tay, phòng đủ sáng.
- **Bấm phép mà cả khung hình trắng xoá** → video hiệu ứng của bạn không có nền
  đen. Xem lại mức 2 ở trên.
- **Ảnh có vệt lạ ở mép sau khi sửa `blur`** → chỉ số âm trong Python **không
  báo lỗi**, nó đếm ngược từ cuối danh sách. Phải `continue` khi hàng xóm rơi
  ra ngoài ảnh.
- **Đảo gương đứng ở "Loading Python"** → bạn đang mở bằng Live Server hoặc
  `python -m http.server`. Phải là `python serve.py`.
- **Console có mấy dòng đỏ về `.mp3` và `.efk`** → kệ nó, bộ này cố ý không kèm
  file âm thanh.

## Mấy phím tiện tay khác

`1`/`2` giữ để giả bộ giơ 1–2 ngón (không cần camera) · `R` nạp lại
`student/*.py` · `T` máy tự chấm · `G` thu gọn bảng · `M` đổi kiểu tách nền ·
`P` chụp ảnh. Không còn phím số nào tự bắn hiệu ứng nữa — `play_effect(...)`
chỉ chạy khi CHÍNH mã Python của bạn gọi nó.

Muốn thử mà không giơ tay: mở Console gõ `student.fingers(2)` hoặc
`student.voice("mưa")`.

## Bí quá thì có đáp án

Nằm ở repo riêng: <https://github.com/nmnhut-it/magic-dust-kit-dap-an>. Tải về,
kéo thư mục bộ đồ nghề này thả vào `CHEP-VAO.bat` là hai file đáp án vào đúng
chỗ, bài cũ của bạn được cất sang `student/bai-cua-toi/`.

Nhưng tự viết xong rồi hãy mở nhé — cái đáng học nằm ở lúc mình vật lộn với nó.

## Bộ này lấy từ đâu

Cắt ra từ dự án Magic Dust của thầy Nhựt — <https://nmnhut.dev/magic-dust/>.
Bạn được sửa, được đăng bản của mình, được đem đi khoe.
