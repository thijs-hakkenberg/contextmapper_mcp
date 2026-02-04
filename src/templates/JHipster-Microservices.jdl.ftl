<#--
  JHipster Microservices JDL Template
  Generates JHipster JDL for microservices architecture

  Each bounded context becomes a microservice application.
  Aggregates become entities with relationships.
-->
<#-- Generate application definitions -->
<#list boundedContexts as bc>
application {
  config {
    baseName ${bc.name?replace(" ", "")?uncap_first}
    applicationType microservice
    packageName com.example.${bc.name?replace(" ", "")?lower_case}
    authenticationType jwt
    prodDatabaseType postgresql
    buildTool gradle
    serverPort ${8080 + bc?index}
  }
  entities <#list bc.aggregates as agg><#list agg.entities as entity>${entity.name}<#if entity?has_next || agg?has_next>, </#if></#list></#list>
}

</#list>
<#-- Generate gateway application -->
application {
  config {
    baseName gateway
    applicationType gateway
    packageName com.example.gateway
    authenticationType jwt
    prodDatabaseType postgresql
    buildTool gradle
    serverPort 8080
  }
}

<#-- Generate entities -->
<#list boundedContexts as bc>
// Entities for ${bc.name}
<#list bc.aggregates as agg>
<#list agg.entities as entity>
/**
 * ${entity.name} entity
<#if entity.documentation??> * ${entity.documentation}</#if>
 * Part of ${agg.name} aggregate in ${bc.name}
 */
@microservice(${bc.name?replace(" ", "")?uncap_first})
entity ${entity.name} {
<#list entity.attributes as attr>
<#if attr.name != "id" && !attr.name?ends_with("Id")>
  ${attr.name} ${mapJHipsterType(attr.type)}<#if attr.nullable?? && !attr.nullable> required</#if>
</#if>
</#list>
}

</#list>
<#-- Generate value objects as embedded or entities -->
<#list agg.valueObjects as vo>
<#if vo.attributes?size gt 2>
/**
 * ${vo.name} value object
<#if vo.documentation??> * ${vo.documentation}</#if>
 */
@microservice(${bc.name?replace(" ", "")?uncap_first})
@readOnly
entity ${vo.name} {
<#list vo.attributes as attr>
  ${attr.name} ${mapJHipsterType(attr.type)}
</#list>
}

</#if>
</#list>
</#list>
</#list>

<#-- Generate relationships -->
<#list boundedContexts as bc>
<#list bc.aggregates as agg>
<#if agg.aggregateRoot?? && agg.entities?size gt 1>
// Relationships in ${agg.name}
relationship OneToMany {
<#list agg.entities as entity>
<#if !entity.aggregateRoot?? || !entity.aggregateRoot>
  ${agg.aggregateRoot.name} to ${entity.name}
</#if>
</#list>
}

</#if>
</#list>
</#list>

<#-- Generate enums from domain events/commands (simplified) -->
<#list boundedContexts as bc>
<#list bc.aggregates as agg>
<#if agg.domainEvents?size gt 0>
// Events in ${agg.name} (for reference)
// <#list agg.domainEvents as event>${event.name}<#if event?has_next>, </#if></#list>
</#if>
<#if agg.commands?size gt 0>
// Commands in ${agg.name} (for reference)
// <#list agg.commands as cmd>${cmd.name}<#if cmd?has_next>, </#if></#list>
</#if>
</#list>
</#list>

<#-- Pagination and service configuration -->
paginate * with pagination
service * with serviceClass

<#-- Helper function to map CML types to JHipster types -->
<#function mapJHipsterType cmlType>
  <#if cmlType?starts_with("-")>
    <#return "String">
  <#elseif cmlType == "String">
    <#return "String">
  <#elseif cmlType == "int" || cmlType == "Integer">
    <#return "Integer">
  <#elseif cmlType == "long" || cmlType == "Long">
    <#return "Long">
  <#elseif cmlType == "float" || cmlType == "Float">
    <#return "Float">
  <#elseif cmlType == "double" || cmlType == "Double">
    <#return "Double">
  <#elseif cmlType == "boolean" || cmlType == "Boolean">
    <#return "Boolean">
  <#elseif cmlType == "DateTime" || cmlType == "Date">
    <#return "Instant">
  <#elseif cmlType == "BigDecimal">
    <#return "BigDecimal">
  <#elseif cmlType == "UUID">
    <#return "UUID">
  <#elseif cmlType?starts_with("List<") || cmlType?starts_with("Set<")>
    <#return "String">
  <#else>
    <#return "String">
  </#if>
</#function>
