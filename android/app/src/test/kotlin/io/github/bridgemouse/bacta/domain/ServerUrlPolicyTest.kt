package io.github.bridgemouse.bacta.domain

import io.github.bridgemouse.bacta.data.network.ServerConfig
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import kotlin.test.assertEquals
import org.junit.Test

class ServerUrlPolicyTest {
    private val allow = listOf("bacta.home", "192.168.1.119")

    @Test
    fun cleartextHostOutsideTheAllowlistIsRejectedWithAnExplanation() {
        assertEquals(ServerUrlCheck.CleartextBlocked("example.org"), ServerUrlPolicy.check("http://example.org/", allow))
        assertEquals(ServerUrlCheck.CleartextBlocked("192.168.1.50"), ServerUrlPolicy.check("http://192.168.1.50:3001/", allow))
    }

    @Test
    fun allowlistedCleartextAndAnyHttpsAreAllowed() {
        assertEquals(ServerUrlCheck.Allowed, ServerUrlPolicy.check("http://bacta.home/", allow))
        assertEquals(ServerUrlCheck.Allowed, ServerUrlPolicy.check("http://192.168.1.119:3001/", allow))
        assertEquals(ServerUrlCheck.Allowed, ServerUrlPolicy.check("https://anything.example/", allow))
    }

    @Test
    fun aMalformedAddressIsMalformedNotBlocked() {
        assertEquals(ServerUrlCheck.Malformed, ServerUrlPolicy.check("not a url", allow))
        assertEquals(ServerUrlCheck.Malformed, ServerUrlPolicy.check("ftp://bacta.home/", allow))
        assertEquals(ServerUrlCheck.Malformed, ServerUrlPolicy.check("", allow))
    }

    @Test
    fun theDeclaredHostsMatchTheNetworkSecurityConfig() {
        val doc = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(File("src/main/res/xml/network_security_config.xml"))
        val nodes = doc.getElementsByTagName("domain")
        val fromXml = (0 until nodes.length).map { nodes.item(it).textContent.trim() }
        assertEquals(fromXml.toSet(), ServerConfig.CLEARTEXT_HOSTS.toSet())
    }

    @Test
    fun everyDefaultServerPassesThePolicy() {
        ServerConfig.DEFAULT_CANDIDATES.forEach {
            assertEquals(ServerUrlCheck.Allowed, ServerUrlPolicy.check(it.toString(), ServerConfig.CLEARTEXT_HOSTS), it.toString())
        }
    }
}
