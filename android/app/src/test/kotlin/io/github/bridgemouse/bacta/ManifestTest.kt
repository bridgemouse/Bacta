package io.github.bridgemouse.bacta

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ManifestTest {
    private val doc = DocumentBuilderFactory.newInstance().newDocumentBuilder()
        .parse(File("src/main/AndroidManifest.xml"))

    @Test
    fun declaresOnlyTheNetworkPermissionsItNeeds() {
        val nodes = doc.getElementsByTagName("uses-permission")
        val names = (0 until nodes.length).map { nodes.item(it).attributes.getNamedItem("android:name").nodeValue }.toSet()
        assertEquals(setOf("android.permission.INTERNET", "android.permission.ACCESS_LOCAL_NETWORK"), names)
    }

    @Test
    fun backupIsOffAndCleartextIsNotEnabledGlobally() {
        val app = doc.getElementsByTagName("application").item(0)
        assertEquals("false", app.attributes.getNamedItem("android:allowBackup").nodeValue)
        assertNull(app.attributes.getNamedItem("android:usesCleartextTraffic"))
    }

    @Test
    fun applicationClassIsBactaApp() {
        val app = doc.getElementsByTagName("application").item(0)
        assertEquals(".BactaApp", app.attributes.getNamedItem("android:name").nodeValue)
    }

    @Test
    fun launcherIconIsAnAdaptiveIconWithAMonochromeLayer() {
        val app = doc.getElementsByTagName("application").item(0)
        assertEquals("@mipmap/ic_launcher", app.attributes.getNamedItem("android:icon").nodeValue)
        val icon = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(File("src/main/res/mipmap-anydpi/ic_launcher.xml"))
        assertEquals("adaptive-icon", icon.documentElement.tagName)
        listOf("background", "foreground", "monochrome").forEach { layer ->
            assertEquals("missing $layer layer", 1, icon.getElementsByTagName(layer).length)
        }
        assertEquals(true, File("src/main/res/drawable-nodpi/ic_launcher_foreground.png").isFile)
        assertEquals(true, File("src/main/res/drawable-nodpi/ic_launcher_monochrome.png").isFile)
        assertEquals(true, File("src/main/res/values/ic_launcher_background.xml").isFile)
    }
}
