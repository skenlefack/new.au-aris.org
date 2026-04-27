package org.auibar.aris.mobile.data.mapper

import org.auibar.aris.mobile.data.remote.dto.CampaignDto
import org.auibar.aris.mobile.data.remote.dto.FormTemplateDto
import org.auibar.aris.mobile.data.remote.dto.TargetDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TargetMapperTest {

    @Test
    fun `campaignTargetsFromDto uses targets when present`() {
        val dto = CampaignDto(
            id = "c1",
            tenantId = "t1",
            name = "Test",
            domain = "ANIMAL_HEALTH",
            templateId = "tpl1",
            startDate = "2026-01-01T00:00:00Z",
            endDate = "2026-12-31T00:00:00Z",
            status = "ACTIVE",
            targets = listOf(
                TargetDto(id = "t1", domainCode = "ANIMAL_HEALTH", subDomainCode = "SURVEILLANCE", isPrimary = true),
                TargetDto(id = "t2", domainCode = "LIVESTOCK_PROD", isPrimary = false),
            ),
        )

        val entities = TargetMapper.campaignTargetsFromDto(dto, 1000L)

        assertEquals(2, entities.size)
        assertEquals("c1", entities[0].campaignId)
        assertEquals("t1", entities[0].id)
        assertTrue(entities[0].isPrimary)
        assertEquals("SURVEILLANCE", entities[0].subDomainCode)
        assertEquals("t2", entities[1].id)
        assertEquals(false, entities[1].isPrimary)
    }

    @Test
    fun `campaignTargetsFromDto falls back to legacy domain when targets is null`() {
        val dto = CampaignDto(
            id = "c1",
            tenantId = "t1",
            name = "Test",
            domain = "ANIMAL_HEALTH",
            templateId = "tpl1",
            startDate = "2026-01-01T00:00:00Z",
            endDate = "2026-12-31T00:00:00Z",
            status = "ACTIVE",
            targets = null,
        )

        val entities = TargetMapper.campaignTargetsFromDto(dto, 1000L)

        assertEquals(1, entities.size)
        assertEquals("c1_legacy", entities[0].id)
        assertTrue(entities[0].isPrimary)
        assertEquals(null, entities[0].subDomainCode)
    }

    @Test
    fun `campaignTargetsFromDto falls back to legacy domain when targets is empty`() {
        val dto = CampaignDto(
            id = "c1",
            tenantId = "t1",
            name = "Test",
            domain = "ANIMAL_HEALTH",
            templateId = "tpl1",
            startDate = "2026-01-01T00:00:00Z",
            endDate = "2026-12-31T00:00:00Z",
            status = "ACTIVE",
            targets = emptyList(),
        )

        val entities = TargetMapper.campaignTargetsFromDto(dto, 1000L)

        assertEquals(1, entities.size)
        assertEquals("c1_legacy", entities[0].id)
    }

    @Test
    fun `templateTargetsFromDto uses targets when present`() {
        val dto = FormTemplateDto(
            id = "tpl1",
            name = "Template",
            domain = "ANIMAL_HEALTH",
            schema = "{}",
            uiSchema = "{}",
            version = 1,
            targets = listOf(
                TargetDto(id = "ft1", domainCode = "ANIMAL_HEALTH", isPrimary = true),
            ),
        )

        val entities = TargetMapper.templateTargetsFromDto(dto, 1000L)

        assertEquals(1, entities.size)
        assertEquals("tpl1", entities[0].templateId)
        assertEquals("ft1", entities[0].id)
    }

    @Test
    fun `templateTargetsFromDto falls back to legacy domain when no targets`() {
        val dto = FormTemplateDto(
            id = "tpl1",
            name = "Template",
            domain = "FISHERIES",
            schema = "{}",
            uiSchema = "{}",
            version = 1,
            targets = null,
        )

        val entities = TargetMapper.templateTargetsFromDto(dto, 1000L)

        assertEquals(1, entities.size)
        assertEquals("tpl1_legacy", entities[0].id)
        assertTrue(entities[0].isPrimary)
    }
}
