// Tests for Store.java (the phone app's plain logic) on a normal computer:
//   javac -cp json.jar -d out ../src/com/alts/phone/Store.java StoreTest.java && java -cp json.jar:out StoreTest
// (json.jar = org.json from Maven Central; Android has it built in.)
import com.alts.phone.Store;
import java.io.File;
import java.nio.file.Files;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public class StoreTest {
    static int failures = 0;

    static void check(boolean ok, String what) {
        System.out.println((ok ? "  PASS " : "  FAIL ") + what);
        if (!ok) failures++;
    }

    public static void main(String[] args) throws Exception {
        File dir = Files.createTempDirectory("alts-store").toFile();

        System.out.println("files");
        File f = new File(dir, "a/b/x.json");
        check(Store.write(f, "{\"x\":1}") && Store.read(f).equals("{\"x\":1}"), "write creates folders, read gets it back");
        check(Store.write(f, "two") && Store.read(f).equals("two") && !new File(f.getPath() + ".tmp").exists(), "rewrite replaces it, no temp file left");
        check(Store.read(new File(dir, "nope")).isEmpty(), "missing file reads as empty");
        check(Store.safeId("181913649").equals("181913649") && Store.safeId("../../etc").equals("etc"), "ids from the internet can't climb folders");
        check(Store.safeName("a/b:c*?\"<>|d").equals("a b c d") && Store.safeName("").equals("Chat"), "file-safe chat names");

        System.out.println("accounts");
        JSONObject acc = Store.parseAccounts("garbage");
        check(acc.optJSONArray("list").length() == 1 && acc.optString("active").equals("default"), "a broken file starts with Main");
        String id2 = Store.addAccount(acc, "School");
        check(acc.optString("active").equals(id2) && Store.find(acc, id2).optString("name").equals("School"), "+ Add makes it active");
        check(!Store.find(acc, id2).optString("color").equals(Store.find(acc, "default").optString("color")), "a different color than Main");
        String id3 = Store.addAccount(acc, "");
        check(!id3.equals(id2), "two accounts added in the same millisecond still get their own ids");
        check(Store.find(acc, id3).optString("name").equals("Account 3"), "no name: Account 3");
        check(!Store.removeAccount(acc, "default"), "Main (the first login) can't be removed");
        check(Store.removeAccount(acc, id2) && Store.find(acc, id2) == null, "remove another one");
        Store.put(acc, "active", id3);
        check(Store.removeAccount(acc, id3) && acc.optString("active").equals("default"), "removing the active one goes back to Main");
        JSONObject back = Store.parseAccounts(acc.toString());
        check(back.optJSONArray("list").length() == 1, "survives a save + load");
        JSONObject bad = Store.parseAccounts("{\"list\":[{\"id\":\"q\",\"name\":\"Q\"}],\"active\":\"gone\"}");
        check(bad.optString("active").equals("q"), "active pointing nowhere is fixed");

        System.out.println("stickers");
        JSONObject st = Store.parseStickers("");
        check(st.optJSONArray("list").length() == 0 && Store.memesStale(st), "empty box wants memes");
        Store.stickerAdd(st, "meme-1", "Drake Hotline Bling", "meme", "1.jpg");
        Store.stickerAdd(st, "mine-a", "Your sticker", "mine", "mine-a.jpg");
        check(Store.memesStale(st), "memes with no 'updated' time get freshened");
        Store.put(st, "updated", System.currentTimeMillis());
        check(!Store.memesStale(st), "fresh memes stay for 3 days");
        Store.put(st, "updated", System.currentTimeMillis() - 4L * 86400000);
        check(Store.memesStale(st), "after 4 days they're freshened");
        Store.put(Store.stickerFind(st, "mine-a"), "fav", true);
        Store.stickerAdd(st, "meme-1", "Drake (new name)", "meme", "1.jpg");
        check(st.optJSONArray("list").length() == 2 && Store.stickerFind(st, "meme-1").optString("name").equals("Drake (new name)"), "same sticker again updates it, no copy");
        check(Store.stickerFind(Store.parseStickers(st.toString()), "mine-a").optBoolean("fav"), "favorites survive a save + load");

        System.out.println("imgflip + GIPHY answers");
        String imgflip = "{\"success\":true,\"data\":{\"memes\":[{\"id\":\"181913649\",\"name\":\"Drake Hotline Bling\",\"url\":\"https://i.imgflip.com/30b1gx.jpg\"},"
            + "{\"id\":\"../x\",\"name\":\"Sneaky\",\"url\":\"https://i.imgflip.com/a.jpg\"},{\"id\":\"9\",\"name\":\"\",\"url\":\"https://x/y.jpg\"},"
            + "{\"id\":\"8\",\"name\":\"Plain http\",\"url\":\"http://i.imgflip.com/b.jpg\"}]}}";
        List<Store.Meme> memes = Store.parseImgflip(imgflip);
        check(memes.size() == 2 && memes.get(0).id.equals("meme-181913649") && memes.get(1).id.equals("meme-x"), "good ones kept, no name / no https dropped, ids cleaned");
        check(Store.parseImgflip("<html>error</html>").isEmpty(), "a broken answer adds nothing");
        String giphy = "{\"data\":[{\"id\":\"abc\",\"title\":\"Anime Cry GIF by Crunchyroll\",\"images\":{\"fixed_width_still\":{\"url\":\"https://media.giphy.com/s.gif\"},"
            + "\"downsized\":{\"url\":\"https://media.giphy.com/d.gif\"}}},{\"id\":\"nope\",\"images\":{}}]}";
        List<Store.Giphy> g = Store.parseGiphy(giphy);
        check(g.size() == 1 && g.get(0).name.equals("Anime Cry") && g.get(0).sendUrl.endsWith("d.gif") && g.get(0).thumbUrl.endsWith("s.gif"), "GIPHY: still picture to show, gif to send, tidy name");

        System.out.println("saved chats");
        JSONObject chats = Store.parseChats("");
        JSONObject c1 = Store.chatAdd(chats, "default", "Brocast fix", "https://claude.ai/chat/111?x=1", 1200);
        Thread.sleep(3);
        JSONObject c2 = Store.chatAdd(chats, "default", "Pasta night", "https://claude.ai/chat/222", 300);
        JSONObject again = Store.chatAdd(chats, "default", "Brocast fix (later)", "https://claude.ai/chat/111", 2400);
        check(chats.optJSONArray("list").length() == 2 && again.optString("id").equals(c1.optString("id")) && again.optInt("words") == 2400, "saving the same chat again replaces it");
        Thread.sleep(3);
        JSONObject other = Store.chatAdd(chats, "a1", "Brocast fix", "https://claude.ai/chat/111", 50);
        check(!other.optString("id").equals(c1.optString("id")), "the same chat link on another account is its own save");
        java.util.Map<String, String> md = new java.util.HashMap<>();
        md.put(c2.optString("id"), "# Pasta night\n\nBoil the water first, then add salt and the pasta.");
        md.put(c1.optString("id"), "# Brocast\n\nthe anime freeze was the MSE timeline");
        List<Store.Hit> hits = Store.chatSearch(chats, "salt", c -> md.getOrDefault(c.optString("id"), ""));
        check(hits.size() == 1 && hits.get(0).chat.optString("id").equals(c2.optString("id")) && hits.get(0).snippet.toLowerCase().contains("salt"), "search finds words inside a chat, with a snippet");
        check(Store.chatSearch(chats, "brocast", c -> "").size() == 2, "search finds titles");
        List<Store.Hit> all = Store.chatSearch(chats, "", null);
        check(all.size() == 3 && all.get(0).chat.optString("account").equals("a1"), "no search: all of them, newest first");

        System.out.println("passing text into the page");
        String js = Store.jsString("a\"b\\c\n</script><x> ");
        check(js.equals("\"a\\\"b\\\\c\\n\\u003c/script>\\u003cx>\\u2028\""), "quotes, backslashes, newlines, </script> and line separators are safe: " + js);

        System.out.println(failures == 0 ? "\nALL STORE CHECKS PASSED" : "\n" + failures + " FAILED");
        System.exit(failures == 0 ? 0 : 1);
    }
}
