<#--
  Full Domain Report Template
  Generates comprehensive documentation for the domain model

  Includes:
  - Executive summary
  - Context map visualization description
  - Detailed bounded context documentation
  - Relationship analysis
  - Technical recommendations
-->
# Domain Model Report

<#if model.name??>
## ${model.name}
</#if>

<#if contextMap?? && contextMap.state??>
**State:** ${contextMap.state}
</#if>

**Generated:** ${.now?string("yyyy-MM-dd HH:mm:ss")}

---

## Executive Summary

<#assign totalContexts = boundedContexts?size>
<#assign totalAggregates = 0>
<#assign totalEntities = 0>
<#assign totalValueObjects = 0>
<#assign totalEvents = 0>
<#assign totalCommands = 0>
<#list boundedContexts as bc>
  <#assign totalAggregates = totalAggregates + bc.aggregates?size>
  <#list bc.aggregates as agg>
    <#assign totalEntities = totalEntities + agg.entities?size>
    <#assign totalValueObjects = totalValueObjects + agg.valueObjects?size>
    <#assign totalEvents = totalEvents + agg.domainEvents?size>
    <#assign totalCommands = totalCommands + agg.commands?size>
  </#list>
</#list>

This domain model consists of:

| Metric | Count |
|--------|-------|
| Bounded Contexts | ${totalContexts} |
| Aggregates | ${totalAggregates} |
| Entities | ${totalEntities} |
| Value Objects | ${totalValueObjects} |
| Domain Events | ${totalEvents} |
| Commands | ${totalCommands} |

<#if contextMap?? && contextMap.relationships?size gt 0>
| Relationships | ${contextMap.relationships?size} |
</#if>

---

## Context Map Overview

<#if contextMap??>
<#if contextMap.relationships?size gt 0>
The domain is organized into ${totalContexts} bounded contexts with ${contextMap.relationships?size} relationships between them.

### Relationship Summary

<#assign partnerships = 0>
<#assign sharedKernels = 0>
<#assign upstreamDownstream = 0>
<#list contextMap.relationships as rel>
  <#if rel.type == "Partnership">
    <#assign partnerships = partnerships + 1>
  <#elseif rel.type == "SharedKernel">
    <#assign sharedKernels = sharedKernels + 1>
  <#elseif rel.type == "UpstreamDownstream">
    <#assign upstreamDownstream = upstreamDownstream + 1>
  </#if>
</#list>

| Relationship Type | Count | Description |
|-------------------|-------|-------------|
| Partnership | ${partnerships} | Collaborative relationships between teams |
| Shared Kernel | ${sharedKernels} | Shared domain model portions |
| Upstream/Downstream | ${upstreamDownstream} | Producer/Consumer relationships |

### Relationship Details

<#list contextMap.relationships as rel>
<#if rel.type == "Partnership">
**Partnership:** ${rel.participant1} <-> ${rel.participant2}
- Both contexts collaborate as partners with shared goals
- Changes require coordination between teams

<#elseif rel.type == "SharedKernel">
**Shared Kernel:** ${rel.participant1} <-> ${rel.participant2}
- Both contexts share a portion of the domain model
- Changes to shared model require agreement from both teams

<#elseif rel.type == "UpstreamDownstream">
**Upstream/Downstream:** ${rel.upstream} -> ${rel.downstream}
<#if rel.upstreamPatterns?? && rel.upstreamPatterns?size gt 0>
- Upstream patterns: <#list rel.upstreamPatterns as p>${p}<#if p?has_next>, </#if></#list>
  <#if rel.upstreamPatterns?seq_contains("OHS")>
  - *Open Host Service*: Upstream provides a well-defined API
  </#if>
  <#if rel.upstreamPatterns?seq_contains("PL")>
  - *Published Language*: Uses a shared documented language
  </#if>
</#if>
<#if rel.downstreamPatterns?? && rel.downstreamPatterns?size gt 0>
- Downstream patterns: <#list rel.downstreamPatterns as p>${p}<#if p?has_next>, </#if></#list>
  <#if rel.downstreamPatterns?seq_contains("ACL")>
  - *Anti-Corruption Layer*: Downstream protects its model from upstream changes
  </#if>
  <#if rel.downstreamPatterns?seq_contains("CF")>
  - *Conformist*: Downstream conforms to upstream's model
  </#if>
</#if>
<#if rel.exposedAggregates?? && rel.exposedAggregates?size gt 0>
- Exposed aggregates: <#list rel.exposedAggregates as ea>${ea}<#if ea?has_next>, </#if></#list>
</#if>

</#if>
</#list>
<#else>
*No relationships defined between bounded contexts.*
</#if>
<#else>
*No context map defined.*
</#if>

---

## Bounded Contexts

<#list boundedContexts as bc>
### ${bc.name}

<#if bc.domainVisionStatement??>
> ${bc.domainVisionStatement}

</#if>
<#if bc.implementationTechnology??>
**Implementation Technology:** ${bc.implementationTechnology}

</#if>
<#if bc.responsibilities?? && bc.responsibilities?size gt 0>
**Responsibilities:**
<#list bc.responsibilities as resp>
- ${resp}
</#list>

</#if>
<#if bc.knowledgeLevel??>
**Knowledge Level:** ${bc.knowledgeLevel}

</#if>

#### Statistics

| Element Type | Count |
|--------------|-------|
| Aggregates | ${bc.aggregates?size} |
<#assign bcEntities = 0>
<#assign bcVOs = 0>
<#assign bcEvents = 0>
<#assign bcCommands = 0>
<#assign bcServices = 0>
<#list bc.aggregates as agg>
  <#assign bcEntities = bcEntities + agg.entities?size>
  <#assign bcVOs = bcVOs + agg.valueObjects?size>
  <#assign bcEvents = bcEvents + agg.domainEvents?size>
  <#assign bcCommands = bcCommands + agg.commands?size>
  <#assign bcServices = bcServices + agg.services?size>
</#list>
| Entities | ${bcEntities} |
| Value Objects | ${bcVOs} |
| Domain Events | ${bcEvents} |
| Commands | ${bcCommands} |
| Services | ${bcServices} |

<#if bc.aggregates?size gt 0>
#### Aggregates

<#list bc.aggregates as agg>
##### ${agg.name}

<#if agg.responsibilities?? && agg.responsibilities?size gt 0>
**Responsibilities:**
<#list agg.responsibilities as resp>
- ${resp}
</#list>

</#if>
<#if agg.aggregateRoot??>
**Aggregate Root:** ${agg.aggregateRoot.name}

| Attribute | Type | Key | Nullable |
|-----------|------|-----|----------|
<#list agg.aggregateRoot.attributes as attr>
| ${attr.name} | ${attr.type} | <#if attr.key?? && attr.key>Yes<#else>No</#if> | <#if attr.nullable?? && attr.nullable>Yes<#else>No</#if> |
</#list>

<#if agg.aggregateRoot.operations?? && agg.aggregateRoot.operations?size gt 0>
**Operations:**
<#list agg.aggregateRoot.operations as op>
- `${op.name}(<#list op.parameters as p>${p.type} ${p.name}<#if p?has_next>, </#if></#list>): ${op.returnType!"void"}`
</#list>

</#if>
</#if>
<#if agg.entities?size gt 1 || (agg.entities?size == 1 && !agg.aggregateRoot??)>
**Other Entities:**

<#list agg.entities as entity>
<#if !entity.aggregateRoot?? || !entity.aggregateRoot>
- **${entity.name}**
<#list entity.attributes as attr>
  - ${attr.name}: ${attr.type}
</#list>
</#if>
</#list>

</#if>
<#if agg.valueObjects?size gt 0>
**Value Objects:**

<#list agg.valueObjects as vo>
- **${vo.name}**: <#list vo.attributes as attr>${attr.name}<#if attr?has_next>, </#if></#list>
</#list>

</#if>
<#if agg.domainEvents?size gt 0>
**Domain Events:**

| Event | Attributes |
|-------|------------|
<#list agg.domainEvents as event>
| ${event.name} | <#list event.attributes as attr>${attr.name}: ${attr.type}<#if attr?has_next>, </#if></#list> |
</#list>

</#if>
<#if agg.commands?size gt 0>
**Commands:**

| Command | Attributes |
|---------|------------|
<#list agg.commands as cmd>
| ${cmd.name} | <#list cmd.attributes as attr>${attr.name}: ${attr.type}<#if attr?has_next>, </#if></#list> |
</#list>

</#if>
<#if agg.services?size gt 0>
**Services:**

<#list agg.services as svc>
- **${svc.name}**
<#list svc.operations as op>
  - `${op.name}(<#list op.parameters as p>${p.type} ${p.name}<#if p?has_next>, </#if></#list>): ${op.returnType!"void"}`
</#list>
</#list>

</#if>
---

</#list>
</#if>
</#list>

## Recommendations

### Architecture Patterns

Based on the context map analysis:

<#if contextMap?? && upstreamDownstream?? && upstreamDownstream gt 0>
1. **API Gateway**: Consider implementing an API gateway to manage cross-context communication
2. **Event-Driven Architecture**: The ${totalEvents} domain events suggest opportunities for asynchronous communication
3. **CQRS**: The separation of commands (${totalCommands}) and domain events supports CQRS implementation
<#else>
1. **Define Relationships**: Consider defining explicit relationships between bounded contexts
2. **Event Storming**: Conduct event storming sessions to identify domain events and commands
</#if>

### Implementation Considerations

<#list boundedContexts as bc>
<#if bc.implementationTechnology??>
- **${bc.name}**: ${bc.implementationTechnology}
</#if>
</#list>

---

*Generated by Context Mapper MCP Server*
