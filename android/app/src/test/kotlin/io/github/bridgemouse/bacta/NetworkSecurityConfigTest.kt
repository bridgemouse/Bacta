package io.github.bridgemouse.bacta

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import org.junit.Assert.assertEquals
import org.junit.Test

class NetworkSecurityConfigTest {
    private val doc = DocumentBuilderFactory.newInstance().newDocumentBuilder()
        .parse(File("src/main/res/xml/network_security_config.xml"))

    @Test
    fun cleartextIsForbiddenByDefault() {
        val base = doc.getElementsByTagName("base-config").item(0)
        assertEquals("false", base.attributes.getNamedItem("cleartextTrafficPermitted").nodeValue)
    }

    @Test
    fun cleartextIsAllowedOnlyForTheBactaServerHosts() {
        val domainConfigs = doc.getElementsByTagName("domain-config")
        assertEquals(1, domainConfigs.length)
        assertEquals("true", domainConfigs.item(0).attributes.getNamedItem("cleartextTrafficPermitted").nodeValue)
        val domains = doc.getElementsByTagName("domain")
        val hosts = (0 until domains.length).map { domains.item(it).textContent.trim() }.toSet()
        assertEquals(setOf("bacta.home", "192.168.1.119"), hosts)
    }
}
