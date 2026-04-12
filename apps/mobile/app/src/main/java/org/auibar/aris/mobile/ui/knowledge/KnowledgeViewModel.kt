package org.auibar.aris.mobile.ui.knowledge

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.remote.dto.KnowledgeCategoryDto
import org.auibar.aris.mobile.data.remote.dto.KnowledgeCourseDto
import org.auibar.aris.mobile.data.remote.dto.KnowledgePublicationDto
import org.auibar.aris.mobile.data.remote.dto.KnowledgeStatsDto
import org.auibar.aris.mobile.data.repository.KnowledgeRepository
import javax.inject.Inject

@HiltViewModel
class KnowledgeViewModel @Inject constructor(
    private val repository: KnowledgeRepository,
) : ViewModel() {

    private val _publications = MutableStateFlow<List<KnowledgePublicationDto>>(emptyList())
    val publications: StateFlow<List<KnowledgePublicationDto>> = _publications.asStateFlow()

    private val _categories = MutableStateFlow<List<KnowledgeCategoryDto>>(emptyList())
    val categories: StateFlow<List<KnowledgeCategoryDto>> = _categories.asStateFlow()

    private val _searchResults = MutableStateFlow<List<KnowledgePublicationDto>>(emptyList())
    val searchResults: StateFlow<List<KnowledgePublicationDto>> = _searchResults.asStateFlow()

    private val _courses = MutableStateFlow<List<KnowledgeCourseDto>>(emptyList())
    val courses: StateFlow<List<KnowledgeCourseDto>> = _courses.asStateFlow()

    private val _selectedArticle = MutableStateFlow<KnowledgePublicationDto?>(null)
    val selectedArticle: StateFlow<KnowledgePublicationDto?> = _selectedArticle.asStateFlow()

    private val _selectedCourse = MutableStateFlow<KnowledgeCourseDto?>(null)
    val selectedCourse: StateFlow<KnowledgeCourseDto?> = _selectedCourse.asStateFlow()

    private val _stats = MutableStateFlow<KnowledgeStatsDto?>(null)
    val stats: StateFlow<KnowledgeStatsDto?> = _stats.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init {
        loadPublications()
        loadCategories()
        loadStats()
    }

    fun loadPublications(forceRefresh: Boolean = false) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.getPublications(forceRefresh = forceRefresh)
                .onSuccess { _publications.value = it }
                .onFailure { _error.value = it.message ?: "Failed to load publications" }
            _isLoading.value = false
        }
    }

    fun loadCategories() {
        viewModelScope.launch {
            repository.getCategories()
                .onSuccess { _categories.value = it }
                .onFailure { /* silently fail for categories */ }
        }
    }

    private fun loadStats() {
        viewModelScope.launch {
            repository.getStats()
                .onSuccess { _stats.value = it }
                .onFailure { /* silently fail for stats */ }
        }
    }

    fun search(query: String) {
        if (query.isBlank()) {
            _searchResults.value = emptyList()
            return
        }
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.search(query)
                .onSuccess { _searchResults.value = it }
                .onFailure { _error.value = it.message ?: "Search failed" }
            _isLoading.value = false
        }
    }

    fun loadCourses() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.getCourses()
                .onSuccess { _courses.value = it }
                .onFailure { _error.value = it.message ?: "Failed to load courses" }
            _isLoading.value = false
        }
    }

    fun loadArticle(id: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.getArticle(id)
                .onSuccess { _selectedArticle.value = it }
                .onFailure { _error.value = it.message ?: "Failed to load article" }
            _isLoading.value = false
        }
    }

    fun loadCourse(id: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.getCourse(id)
                .onSuccess { _selectedCourse.value = it }
                .onFailure { _error.value = it.message ?: "Failed to load course" }
            _isLoading.value = false
        }
    }

    fun enroll(courseId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.enrollInCourse(courseId)
                .onSuccess { loadCourse(courseId) }
                .onFailure { _error.value = it.message ?: "Enrollment failed" }
            _isLoading.value = false
        }
    }
}
